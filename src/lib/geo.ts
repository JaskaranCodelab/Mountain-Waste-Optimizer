import { DEPOT } from '../data/mockStops';
import type { LatLng } from '../types';

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function polylineLengthKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

export function cumulativeDistances(points: LatLng[]): number[] {
  const values: number[] = [0];
  for (let i = 1; i < points.length; i += 1) {
    values.push(values[i - 1] + haversineKm(points[i - 1], points[i]));
  }
  return values;
}

export function pointAtFraction(points: LatLng[], fraction: number): LatLng {
  if (points.length === 0) {
    return { lat: DEPOT.lat, lng: DEPOT.lng };
  }
  if (points.length === 1) {
    return points[0];
  }
  const clamped = Math.min(1, Math.max(0, fraction));
  const cumulative = cumulativeDistances(points);
  const total = cumulative[cumulative.length - 1];
  if (total === 0) {
    return points[0];
  }
  const target = clamped * total;
  let index = 1;
  while (index < cumulative.length && cumulative[index] < target) {
    index += 1;
  }
  if (index >= points.length) {
    return points[points.length - 1];
  }
  const startDistance = cumulative[index - 1];
  const endDistance = cumulative[index];
  const span = endDistance - startDistance;
  const segmentFraction = span === 0 ? 0 : (target - startDistance) / span;
  const from = points[index - 1];
  const to = points[index];
  return {
    lat: from.lat + (to.lat - from.lat) * segmentFraction,
    lng: from.lng + (to.lng - from.lng) * segmentFraction,
  };
}

export function splitPolylineAtFraction(
  points: LatLng[],
  fraction: number,
): { covered: LatLng[]; pending: LatLng[] } {
  if (points.length === 0) {
    return { covered: [], pending: [] };
  }
  if (points.length === 1) {
    return { covered: [...points], pending: [...points] };
  }
  const clamped = Math.min(1, Math.max(0, fraction));
  const cumulative = cumulativeDistances(points);
  const total = cumulative[cumulative.length - 1];
  if (total === 0) {
    return { covered: [...points], pending: [...points] };
  }
  const target = clamped * total;
  let index = 1;
  while (index < cumulative.length && cumulative[index] < target) {
    index += 1;
  }
  if (index >= points.length) {
    return { covered: [...points], pending: [points[points.length - 1]] };
  }
  const startDistance = cumulative[index - 1];
  const endDistance = cumulative[index];
  const span = endDistance - startDistance;
  const segmentFraction = span === 0 ? 0 : (target - startDistance) / span;
  const from = points[index - 1];
  const to = points[index];
  const splitPoint = {
    lat: from.lat + (to.lat - from.lat) * segmentFraction,
    lng: from.lng + (to.lng - from.lng) * segmentFraction,
  };
  return {
    covered: [...points.slice(0, index), splitPoint],
    pending: [splitPoint, ...points.slice(index)],
  };
}

export function formatKm(value: number): string {
  return `${value.toLocaleString('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 min';
  }
  const rounded = Math.round(minutes);
  if (rounded < 60) {
    return `${rounded} min`;
  }
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function shortName(name: string): string {
  return name
    .replace(/\b(Municipal|Collection|Yard|Transfer|Market|Depot|Point)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
