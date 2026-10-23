import type { LatLng, RoutingProvider } from '../types';
import { haversineKm } from './geo';

export interface RoadRouteLeg {
  distanceKm: number;
  durationMin: number;
}

export interface RoadRoute {
  geometry: LatLng[];
  distanceKm: number;
  durationMin: number;
  legs: RoadRouteLeg[];
  simulated: boolean;
  provider: string;
  error?: string;
}

export interface FetchRouteOptions {
  provider: RoutingProvider;
  legFactors?: number[];
  timeoutMs?: number;
}

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const VALHALLA_BASE_URL = 'https://valhalla1.openstreetmap.de';
const VALHALLA_MAX_LOCATIONS = 10;
const ESTIMATED_ROAD_FACTOR = 1.32;
const ESTIMATED_SPEED_KMH = 28;
const SUCCESS_CACHE_MS = 5 * 60 * 1000;
const FAILURE_CACHE_MS = 45 * 1000;

interface CacheEntry {
  expires: number;
  value: RoadRoute;
}

interface OsrmLeg {
  distance: number;
  duration: number;
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: {
    coordinates: [number, number][];
  };
  legs: OsrmLeg[];
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: OsrmRoute[];
}

interface ValhallaLeg {
  summary?: {
    length?: number;
    time?: number;
  };
  shape?: string;
}

interface ValhallaResponse {
  trip?: {
    legs?: ValhallaLeg[];
  };
  error?: string;
}

const cache = new Map<string, CacheEntry>();

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function cacheKey(
  points: LatLng[],
  provider: RoutingProvider,
  factors: number[],
): string {
  return [
    provider,
    points.map((point) => `${round(point.lat, 5)},${round(point.lng, 5)}`).join(';'),
    factors.map((factor) => round(factor, 3)).join(','),
  ].join('|');
}

function curvedSegment(
  from: LatLng,
  to: LatLng,
  factor: number,
  index: number,
): { points: LatLng[]; distanceKm: number; durationMin: number } {
  const straightKm = haversineKm(from, to);
  const distanceKm = straightKm * ESTIMATED_ROAD_FACTOR * factor;
  const durationMin = (distanceKm / ESTIMATED_SPEED_KMH) * 60;
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const length = Math.hypot(dx, dy) || 1;
  const offset = length * 0.045 * (index % 2 === 0 ? 1 : -1);
  const perpX = -dy / length;
  const perpY = dx / length;
  const steps = 14;
  const points: LatLng[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const bend = Math.sin(Math.PI * t) * offset;
    points.push({
      lat: from.lat + dy * t + perpY * bend,
      lng: from.lng + dx * t + perpX * bend,
    });
  }
  return { points, distanceKm, durationMin };
}

export function buildSimulatedRoute(
  points: LatLng[],
  factors: number[] = [],
  error?: string,
): RoadRoute {
  if (points.length < 2) {
    return {
      geometry: points.slice(0, 1),
      distanceKm: 0,
      durationMin: 0,
      legs: [],
      simulated: true,
      provider: 'Simulated estimate',
      error,
    };
  }

  const geometry: LatLng[] = [points[0]];
  const legs: RoadRouteLeg[] = [];
  let distanceKm = 0;
  let durationMin = 0;

  for (let i = 1; i < points.length; i += 1) {
    const factor = factors[i - 1] ?? 1;
    const segment = curvedSegment(points[i - 1], points[i], factor, i);
    for (let p = 1; p < segment.points.length; p += 1) {
      geometry.push(segment.points[p]);
    }
    legs.push({
      distanceKm: segment.distanceKm,
      durationMin: segment.durationMin,
    });
    distanceKm += segment.distanceKm;
    durationMin += segment.durationMin;
  }

  return {
    geometry,
    distanceKm,
    durationMin,
    legs,
    simulated: true,
    provider: 'Simulated estimate',
    error,
  };
}

function normalizeLegs(
  rawLegs: OsrmLeg[],
  points: LatLng[],
  factors: number[],
): RoadRouteLeg[] {
  const legs: RoadRouteLeg[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const raw = rawLegs[i];
    if (raw && Number.isFinite(raw.distance) && Number.isFinite(raw.duration)) {
      legs.push({
        distanceKm: raw.distance / 1000,
        durationMin: raw.duration / 60,
      });
      continue;
    }
    const factor = factors[i] ?? 1;
    const distance = haversineKm(points[i], points[i + 1]) * ESTIMATED_ROAD_FACTOR * factor;
    legs.push({
      distanceKm: distance,
      durationMin: (distance / ESTIMATED_SPEED_KMH) * 60,
    });
  }
  return legs;
}

function decodePolyline6(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  const factor = 1e6;
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

function chunkForValhalla(points: LatLng[]): LatLng[][] {
  if (points.length <= VALHALLA_MAX_LOCATIONS) {
    return [points];
  }
  const chunks: LatLng[][] = [];
  let start = 0;
  while (start < points.length - 1) {
    const end = Math.min(points.length, start + VALHALLA_MAX_LOCATIONS);
    chunks.push(points.slice(start, end));
    start = end - 1;
  }
  return chunks;
}

async function requestValhallaChunk(
  points: LatLng[],
  timeoutMs: number,
): Promise<{
  geometry: LatLng[];
  legs: RoadRouteLeg[];
  distanceKm: number;
  durationMin: number;
}> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${VALHALLA_BASE_URL}/route`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locations: points.map((point) => ({ lat: point.lat, lon: point.lng })),
        costing: 'auto',
        directions_options: { units: 'kilometers' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Valhalla responded with HTTP ${response.status}`);
    }
    const payload = (await response.json()) as ValhallaResponse;
    const rawLegs = payload.trip?.legs;
    if (!rawLegs || rawLegs.length !== points.length - 1) {
      throw new Error(payload.error || 'Valhalla returned incomplete legs');
    }

    const geometry: LatLng[] = [];
    const legs: RoadRouteLeg[] = [];
    let distanceKm = 0;
    let durationMin = 0;

    rawLegs.forEach((rawLeg, legIndex) => {
      const length = rawLeg.summary?.length;
      const time = rawLeg.summary?.time;
      if (
        !Number.isFinite(length) ||
        !Number.isFinite(time) ||
        !rawLeg.shape
      ) {
        throw new Error(`Valhalla leg ${legIndex + 1} is incomplete`);
      }
      const shape = decodePolyline6(rawLeg.shape);
      if (shape.length < 2) {
        throw new Error(`Valhalla leg ${legIndex + 1} has no geometry`);
      }
      shape.forEach((point, pointIndex) => {
        if (geometry.length === 0 || pointIndex > 0) {
          geometry.push(point);
        }
      });
      legs.push({
        distanceKm: length as number,
        durationMin: (time as number) / 60,
      });
      distanceKm += length as number;
      durationMin += (time as number) / 60;
    });

    return { geometry, legs, distanceKm, durationMin };
  } finally {
    window.clearTimeout(timer);
  }
}

async function requestValhalla(
  points: LatLng[],
  timeoutMs: number,
): Promise<RoadRoute> {
  const chunkResults = await Promise.all(
    chunkForValhalla(points).map((chunk) =>
      requestValhallaChunk(chunk, timeoutMs),
    ),
  );
  const geometry: LatLng[] = [];
  const legs: RoadRouteLeg[] = [];
  let distanceKm = 0;
  let durationMin = 0;

  chunkResults.forEach((chunk) => {
    chunk.geometry.forEach((point, pointIndex) => {
      if (geometry.length === 0 || pointIndex > 0) {
        geometry.push(point);
      }
    });
    legs.push(...chunk.legs);
    distanceKm += chunk.distanceKm;
    durationMin += chunk.durationMin;
  });

  if (geometry.length < 2) {
    throw new Error('Valhalla returned incomplete geometry');
  }

  return {
    geometry,
    distanceKm,
    durationMin,
    legs,
    simulated: false,
    provider: 'Valhalla public server',
  };
}

async function requestOsrm(
  points: LatLng[],
  factors: number[],
  timeoutMs: number,
): Promise<RoadRoute> {
  const coordinates = points
    .map((point) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
    .join(';');
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`OSRM responded with HTTP ${response.status}`);
    }
    const payload = (await response.json()) as OsrmResponse;
    if (payload.code !== 'Ok' || !payload.routes || payload.routes.length === 0) {
      throw new Error(payload.message || `OSRM routing failed (${payload.code})`);
    }
    const route = payload.routes[0];
    const geometry = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    if (geometry.length < 2) {
      throw new Error('OSRM returned incomplete geometry');
    }
    const legs = normalizeLegs(route.legs ?? [], points, factors);
    return {
      geometry,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      legs,
      simulated: false,
      provider: 'OSRM public server',
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchRoadRoute(
  points: LatLng[],
  options: FetchRouteOptions,
): Promise<RoadRoute> {
  const factors = options.legFactors ?? [];
  if (points.length < 2) {
    return buildSimulatedRoute(points, factors);
  }

  if (options.provider === 'simulated') {
    return buildSimulatedRoute(points, factors);
  }

  const key = cacheKey(points, options.provider, factors);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const timeoutMs = options.timeoutMs ?? 12000;
  try {
    const route = await requestValhalla(points, timeoutMs);
    cache.set(key, { value: route, expires: Date.now() + SUCCESS_CACHE_MS });
    return route;
  } catch (valhallaError) {
    try {
      const route = await requestOsrm(points, factors, timeoutMs);
      cache.set(key, { value: route, expires: Date.now() + SUCCESS_CACHE_MS });
      return route;
    } catch (osrmError) {
      const message =
        osrmError instanceof Error
          ? osrmError.name === 'AbortError'
            ? 'Road routing request timed out'
            : osrmError.message
          : valhallaError instanceof Error
            ? valhallaError.message
            : 'Unknown routing error';
      const fallback = buildSimulatedRoute(points, factors, message);
      cache.set(key, {
        value: fallback,
        expires: Date.now() + FAILURE_CACHE_MS,
      });
      return fallback;
    }
  }
}

export function clearRoutingCache(): void {
  cache.clear();
}
