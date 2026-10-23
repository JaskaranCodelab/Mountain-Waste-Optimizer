import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  CostBreakdown,
  FleetTruck,
  LatLng,
  OptimizationResult,
  RoutePlan,
  RoutePlanId,
  RoutePlanSet,
  RouteOrderPlan,
  RoutingMeta,
  RoutingSource,
  Settings,
  SimulationStatus,
  Stop,
  StopStatus,
  ViewId,
  WasteType,
} from '../types';
import { DEPOT, WASTE_MODE_META, createInitialStopSets } from '../data/mockStops';
import {
  DEFAULT_SETTINGS,
  clampedSettings,
  estimateOperatingCost,
} from '../lib/costCalculator';
import { pointAtFraction } from '../lib/geo';
import {
  accessibilityMultiplier,
  DEPOT_NODE,
  optimizeRoutes,
} from '../lib/routeOptimizer';
import {
  clearRoutingCache,
  fetchRoadRoute,
  type RoadRoute,
} from '../lib/routingService';

const STORAGE_KEY = 'himalaya-route-state-v5';
const TRACKING_API_BASE = (import.meta.env.VITE_TRACKING_API_URL ?? '').replace(/\/+$/, '');
const trackingApiUrl = (path: string) => `${TRACKING_API_BASE}${path}`;

interface PersistedState {
  version: number;
  stopSets: Record<WasteType, Stop[]>;
  settings: Settings;
  wasteMode: WasteType;
}

export type GeoStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface Notice {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'error';
}

export interface DriverTracking {
  truckId: string;
  truckName: string;
  position: LatLng;
  progress: number;
  simulated: boolean;
  startedAt: number;
  accuracyMeters?: number;
  updatedAt?: number;
}

function publishTrackingUpdate(tracking: DriverTracking | null, method: 'POST' | 'DELETE') {
  const body = method === 'POST' && tracking ? JSON.stringify(tracking) : undefined;
  void fetch(trackingApiUrl('/api/tracking'), {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body,
    keepalive: method === 'DELETE',
  }).catch(() => undefined);
}

interface AppContextValue {
  view: ViewId;
  setView: (view: ViewId) => void;
  stops: Stop[];
  wasteMode: WasteType;
  changeWasteMode: (mode: WasteType) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  setCapacityKg: (capacity: number) => void;
  selectedStopId: string | null;
  selectStop: (id: string | null) => void;
  updateStops: (updater: Stop[] | ((prev: Stop[]) => Stop[])) => void;
  upsertStop: (stop: Stop) => void;
  removeStop: (id: string) => void;
  resetDemoData: () => void;
  optimization: OptimizationResult;
  plans: RoutePlanSet;
  routing: RoutingMeta;
  activePlanId: RoutePlanId;
  setActivePlanId: (id: RoutePlanId) => void;
  selectedTruckId: string | null;
  selectTruck: (id: string | null) => void;
  activePlan: RoutePlan | null;
  revealRoute: (id: RoutePlanId) => void;
  retryRouting: () => void;
  optimizeRoute: () => void;
  optimizeRouteForStops: (stopIds: string[]) => void;
  driverTracking: DriverTracking | null;
  startDriverTracking: (truckName: string, position: LatLng, simulated: boolean) => string;
  updateDriverTracking: (position: LatLng, progress: number, simulated: boolean, accuracyMeters?: number) => void;
  stopDriverTracking: () => void;
  trackingConnected: boolean;
  simulationStatus: SimulationStatus;
  progress: number;
  fleet: import('../types').FleetTruck[];
  fleetStatus: SimulationStatus;
  startRoute: () => void;
  pauseRoute: () => void;
  resumeRoute: () => void;
  advanceToNextStop: () => void;
  resetSimulation: () => void;
  fitRoute: () => void;
  fitRequest: number;
  truckPosition: LatLng | null;
  travelledKm: number;
  remainingKm: number;
  nextStopId: string | null;
  nextStop: Stop | null;
  nextStopEtaMin: number | null;
  nextStopDistanceKm: number | null;
  currentLocationLabel: string;
  wasteCollectedKg: number;
  totalWasteKg: number;
  completedCount: number;
  pendingCount: number;
  inProgressCount: number;
  activeCost: CostBreakdown;
  travelledCost: CostBreakdown;
  onboardKg: number;
  unloadedKg: number;
  userLocation: LatLng | null;
  geoStatus: GeoStatus;
  geoMessage: string | null;
  requestGeolocation: () => void;
  notice: Notice | null;
  notify: (message: string, tone?: Notice['tone']) => void;
  dismissNotice: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function isWasteType(value: unknown): value is WasteType {
  return value === 'household' || value === 'pine' || value === 'fruit';
}

function isStopStatus(value: unknown): value is StopStatus {
  return value === 'Pending' || value === 'In Progress' || value === 'Completed';
}

function isStop(value: unknown): value is Stop {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const stop = value as Record<string, unknown>;
  return (
    typeof stop.id === 'string' &&
    typeof stop.name === 'string' &&
    typeof stop.area === 'string' &&
    typeof stop.lat === 'number' &&
    typeof stop.lng === 'number' &&
    isWasteType(stop.wasteType) &&
    typeof stop.quantityKg === 'number' &&
    (stop.priority === 'high' ||
      stop.priority === 'medium' ||
      stop.priority === 'low') &&
    isStopStatus(stop.status) &&
    typeof stop.serviceTimeMin === 'number' &&
    (stop.accessibility === 'easy' ||
      stop.accessibility === 'moderate' ||
      stop.accessibility === 'restricted') &&
    typeof stop.note === 'string'
  );
}

function readPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      stopSets?: Partial<Record<WasteType, unknown>>;
      settings?: Partial<Settings>;
      wasteMode?: unknown;
      version?: number;
    };
    if (!parsed.stopSets) {
      return null;
    }
    const fallback = createInitialStopSets();
    const selectStops = (mode: WasteType): Stop[] => {
      const value = parsed.stopSets?.[mode];
      if (!Array.isArray(value)) {
        return fallback[mode];
      }
      const valid = value.filter(isStop);
      return valid.length === value.length ? valid : fallback[mode];
    };
    const mergedSettings = clampedSettings(parsed.settings ?? {}, DEFAULT_SETTINGS);
    if (parsed.settings?.routingProvider === 'simulated') {
      mergedSettings.routingProvider = 'simulated';
    } else {
      mergedSettings.routingProvider = 'osrm';
    }
    return {
      version: 5,
      stopSets: {
        household: selectStops('household'),
        pine: selectStops('pine'),
        fruit: selectStops('fruit'),
      },
      settings: mergedSettings,
      wasteMode: isWasteType(parsed.wasteMode) ? parsed.wasteMode : 'household',
    };
  } catch {
    return null;
  }
}

function buildRoutePlan(
  id: RoutePlanId,
  orderPlan: RouteOrderPlan,
  road: RoadRoute,
  capacityKg: number,
): RoutePlan {
  const rawLegs = orderPlan.order.slice(1).map((toId, index) => ({
    fromId: orderPlan.order[index],
    toId,
    distanceKm: road.legs[index]?.distanceKm ?? 0,
    durationMin: road.legs[index]?.durationMin ?? 0,
  }));
  const rawDistance = rawLegs.reduce((total, leg) => total + leg.distanceKm, 0);
  const distanceScale =
    rawDistance > 0 && road.distanceKm > 0 ? road.distanceKm / rawDistance : 1;
  const rawDuration = rawLegs.reduce((total, leg) => total + leg.durationMin, 0);
  const durationScale =
    rawDuration > 0 && road.durationMin > 0 ? road.durationMin / rawDuration : 1;
  const legs = rawLegs.map((leg) => ({
    ...leg,
    distanceKm: leg.distanceKm * distanceScale,
    durationMin: leg.durationMin * durationScale,
  }));

  const arrivalKm: Record<string, number> = {};
  const arrivalMin: Record<string, number> = {};
  let cumulativeKm = 0;
  let cumulativeMin = 0;
  orderPlan.order.forEach((nodeId, index) => {
    if (index > 0) {
      const leg = legs[index - 1];
      cumulativeKm += leg?.distanceKm ?? 0;
      cumulativeMin += leg?.durationMin ?? 0;
    }
    if (nodeId !== DEPOT_NODE) {
      arrivalKm[nodeId] = cumulativeKm;
      arrivalMin[nodeId] = cumulativeMin;
    }
  });

  return {
    id,
    label: orderPlan.label,
    order: orderPlan.order,
    stopOrder: orderPlan.stopOrder,
    geometry: road.geometry,
    distanceKm: road.distanceKm,
    durationMin: road.durationMin,
    legs,
    arrivalKm,
    arrivalMin,
    simulated: road.simulated,
    provider: road.provider,
    depotReturns: orderPlan.depotReturns,
    trips: orderPlan.trips,
    totalLoadKg: orderPlan.totalLoadKg,
    maxTripLoadKg: orderPlan.maxTripLoadKg,
    capacityUtilizationPct:
      capacityKg > 0 ? (orderPlan.maxTripLoadKg / capacityKg) * 100 : 0,
    capacityFeasible: orderPlan.capacityFeasible,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readPersistedState);
  const [stopSets, setStopSets] = useState<Record<WasteType, Stop[]>>(
    () => initial?.stopSets ?? createInitialStopSets(),
  );
  const [wasteMode, setWasteMode] = useState<WasteType>(
    () => initial?.wasteMode ?? 'household',
  );
  const [settings, setSettings] = useState<Settings>(
    () => initial?.settings ?? DEFAULT_SETTINGS,
  );
  const [view, setView] = useState<ViewId>('overview');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [activePlanId, setActivePlanIdState] = useState<RoutePlanId>('baseline');
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [simulationStatus, setSimulationStatus] =
    useState<SimulationStatus>('idle');
  const [plans, setPlans] = useState<RoutePlanSet>({
    baseline: null,
    optimized: null,
  });
  const [routing, setRouting] = useState<RoutingMeta>({
    loading: true,
    error: null,
    source: 'pending',
    updatedAt: null,
  });
  const [routingNonce, setRoutingNonce] = useState(0);
  const [optimizeVersion, setOptimizeVersion] = useState(0);
  const [routeScopeIds, setRouteScopeIds] = useState<string[] | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [driverTracking, setDriverTracking] = useState<DriverTracking | null>(null);
  const driverTrackingRef = useRef<DriverTracking | null>(driverTracking);
  const [trackingConnected, setTrackingConnected] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  const stops = stopSets[wasteMode];
  const stopById = useMemo(
    () => new Map(stops.map((stop) => [stop.id, stop])),
    [stops],
  );

  const updateStops = useCallback(
    (updater: Stop[] | ((prev: Stop[]) => Stop[])) => {
      setStopSets((previous) => {
        const current = previous[wasteMode];
        const next =
          typeof updater === 'function'
            ? (updater as (prev: Stop[]) => Stop[])(current)
            : updater;
        if (next === current) {
          return previous;
        }
        return { ...previous, [wasteMode]: next };
      });
    },
    [wasteMode],
  );

  const notify = useCallback(
    (message: string, tone: Notice['tone'] = 'info') => {
      setNotice({ id: Date.now(), message, tone });
    },
    [],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const events = new EventSource(trackingApiUrl('/api/tracking/events'));
    events.onopen = () => setTrackingConnected(true);
    events.onerror = () => setTrackingConnected(false);
    events.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as DriverTracking | null;
        setDriverTracking(update);
      } catch {
        return;
      }
    };
    return () => events.close();
  }, []);

  useEffect(() => {
    driverTrackingRef.current = driverTracking;
  }, [driverTracking]);

  useEffect(() => {
    const payload: PersistedState = {
      version: 5,
      stopSets,
      settings,
      wasteMode,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      return;
    }
  }, [stopSets, settings, wasteMode]);

  const routingSignature = useMemo(
    () =>
      stops.filter((stop) => !routeScopeIds || routeScopeIds.includes(stop.id))
        .map((stop) =>
          [
            stop.id,
            stop.lat.toFixed(5),
            stop.lng.toFixed(5),
            stop.quantityKg,
            stop.priority,
            stop.accessibility,
          ].join(':'),
        )
        .join('|'),
    [stops, routeScopeIds],
  );

  const routeStops = useMemo(
    () => stops.filter((stop) => !routeScopeIds || routeScopeIds.includes(stop.id)),
    [stops, routeScopeIds],
  );

  const optimization = useMemo(
    () => optimizeRoutes(routeStops, settings, DEPOT),
    [routingSignature, settings, optimizeVersion],
  );

  const orderingKey = useMemo(
    () =>
      `${optimization.baseline.order.join('>')}||${optimization.optimized.order.join('>')}`,
    [optimization],
  );

  const previousOrderKey = useRef('');

  useEffect(() => {
    const key = `${wasteMode}|${orderingKey}`;
    if (previousOrderKey.current === '') {
      previousOrderKey.current = key;
      return;
    }
    if (previousOrderKey.current !== key) {
      previousOrderKey.current = key;
      setProgress(0);
      setSimulationStatus('idle');
      updateStops((previous) =>
        previous.some((stop) => stop.status !== 'Pending')
          ? previous.map((stop) => ({ ...stop, status: 'Pending' }))
          : previous,
      );
    }
  }, [wasteMode, orderingKey, updateStops]);

  const activePlan = plans[activePlanId];

  const [fleet, setFleet] = useState<FleetTruck[]>([]);

  useEffect(() => {
    if (!plans.baseline || !plans.optimized || fleet.length > 0) {
      return;
    }
    const stopPool = stops.map((stop) => stop.id);
    const shuffle = (arr: string[]) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    const pool = shuffle(stopPool);
    const assignments: string[][] = [[], []];
    pool.forEach((id, idx) => {
      assignments[idx % 2].push(id);
    });
    const seedTrucks: FleetTruck[] = [
      {
        id: 'TRK-01',
        name: 'Small Truck',
        type: 'Mini waste collection truck',
        capacityKg: 500,
        fuel: 'Diesel',
        bestFor: 'Narrow roads, small markets, restricted-access areas',
        planId: 'baseline',
        progress: 0.08 + Math.random() * 0.12,
        status: 'running',
        speedPct: 0.03 + Math.random() * 0.04,
        color: '#0ea5e9',
        assignedStops: assignments[0],
      },
      {
        id: 'TRK-02',
        name: 'Large Truck',
        type: 'Large waste collection truck',
        capacityKg: 2000,
        fuel: 'Diesel',
        bestFor: 'Main roads, high-waste areas, bulk collection',
        planId: 'optimized',
        progress: 0.14 + Math.random() * 0.1,
        status: 'running',
        speedPct: 0.035 + Math.random() * 0.035,
        color: '#22c55e',
        assignedStops: assignments[1],
      },
    ];
    setFleet(seedTrucks);
    setSimulationStatus('running');
  }, [plans.baseline, plans.optimized, fleet.length, stops]);

  useEffect(() => {
    if (simulationStatus !== 'running' || fleet.length === 0) {
      return;
    }
    const stepScale = Math.max(settings.simulationStepPct, 0.02) / 0.06;
    const timer = window.setInterval(() => {
      setFleet((prev) =>
        prev.flatMap((truck) => {
          const next = truck.progress + (truck.speedPct * stepScale) / 100;
          if (next >= 1) return [];
          return [{ ...truck, progress: Math.max(0, next) }];
        }),
      );
    }, settings.simulationIntervalMs);
    return () => window.clearInterval(timer);
  }, [
    simulationStatus,
    fleet.length,
    settings.simulationIntervalMs,
    settings.simulationStepPct,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (stops.length === 0) {
      setPlans({ baseline: null, optimized: null });
      setRouting({
        loading: false,
        error: null,
        source:
          settings.routingProvider === 'simulated' ? 'simulated' : 'osrm',
        updatedAt: Date.now(),
      });
      return () => {
        cancelled = true;
      };
    }

    setRouting((previous) => ({ ...previous, loading: true, error: null }));

    const nodeData = (order: string[]) =>
      order.reduce<{ points: LatLng[]; factors: number[] }>(
        (accumulator, nodeId) => {
          if (nodeId === DEPOT_NODE) {
            accumulator.points.push({ lat: DEPOT.lat, lng: DEPOT.lng });
            accumulator.factors.push(1);
            return accumulator;
          }
          const stop = stopById.get(nodeId);
          if (!stop) {
            return accumulator;
          }
          accumulator.points.push({ lat: stop.lat, lng: stop.lng });
          accumulator.factors.push(
            accessibilityMultiplier(
              stop.accessibility,
              settings.steepPenaltyPct,
              settings.narrowPenaltyPct,
            ),
          );
          return accumulator;
        },
        { points: [], factors: [] },
      );

    const baselineNodes = nodeData(optimization.baseline.order);
    const optimizedNodes = nodeData(optimization.optimized.order);

    async function run() {
      try {
        const [baselineRoad, optimizedRoad] = await Promise.all([
          fetchRoadRoute(baselineNodes.points, {
            provider: settings.routingProvider,
            legFactors: baselineNodes.factors.slice(1),
          }),
          fetchRoadRoute(optimizedNodes.points, {
            provider: settings.routingProvider,
            legFactors: optimizedNodes.factors.slice(1),
          }),
        ]);
        if (cancelled) {
          return;
        }
        const nextPlans: RoutePlanSet = {
          baseline: buildRoutePlan(
            'baseline',
            optimization.baseline,
            baselineRoad,
            settings.capacityKg,
          ),
          optimized: buildRoutePlan(
            'optimized',
            optimization.optimized,
            optimizedRoad,
            settings.capacityKg,
          ),
        };
        let source: RoutingSource = 'mixed';
        if (baselineRoad.simulated && optimizedRoad.simulated) {
          source = 'simulated';
        } else if (!baselineRoad.simulated && !optimizedRoad.simulated) {
          source = 'osrm';
        }
        setPlans(nextPlans);
        setRouting({
          loading: false,
          error: optimizedRoad.error ?? baselineRoad.error ?? null,
          source,
          updatedAt: Date.now(),
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRouting({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unexpected routing failure. Simulation data remains available.',
          source: 'simulated',
          updatedAt: Date.now(),
        });
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [
    orderingKey,
    routingSignature,
    settings.routingProvider,
    settings.steepPenaltyPct,
    settings.narrowPenaltyPct,
    settings.capacityKg,
    routingNonce,
  ]);

  useEffect(() => {
    const focus =
      (selectedTruckId
        ? fleet.find((truck) => truck.id === selectedTruckId)
        : null) ??
      fleet.find((truck) => truck.planId === activePlanId) ??
      fleet[0];
    if (focus) {
      setProgress(focus.progress);
    }
  }, [activePlanId, fleet, selectedTruckId]);

  const arrivalKey = activePlan
    ? activePlan.stopOrder
        .map((id) => `${id}:${(activePlan.arrivalKm[id] ?? 0).toFixed(4)}`)
        .join('|')
    : '';

  useEffect(() => {
    if (!activePlan || activePlan.stopOrder.length === 0) {
      return;
    }
    if (simulationStatus === 'idle' || progress <= 0) {
      return;
    }
    const total = activePlan.distanceKm > 0 ? activePlan.distanceKm : 1;
    const completedIds = new Set(
      activePlan.stopOrder.filter(
        (id) => (activePlan.arrivalKm[id] ?? 0) / total <= progress + 1e-7,
      ),
    );
    const nextId =
      activePlan.stopOrder.find((id) => !completedIds.has(id)) ?? null;
    updateStops((previous) => {
      let changed = false;
      const next = previous.map((stop) => {
        if (!activePlan.stopOrder.includes(stop.id)) {
          return stop;
        }
        let status: StopStatus;
        if (completedIds.has(stop.id)) {
          status = 'Completed';
        } else if (stop.id === nextId) {
          status = simulationStatus === 'complete' ? 'Completed' : 'In Progress';
        } else {
          status = 'Pending';
        }
        if (stop.status !== status) {
          changed = true;
          return { ...stop, status };
        }
        return stop;
      });
      return changed ? next : previous;
    });
    if (progress >= 1 && simulationStatus === 'running') {
      setSimulationStatus('complete');
    }
  }, [
    progress,
    arrivalKey,
    simulationStatus,
    activePlan,
    updateStops,
  ]);

  const totalWasteKg = useMemo(
    () => stops.reduce((total, stop) => total + stop.quantityKg, 0),
    [stops],
  );
  const completedStops = useMemo(
    () => stops.filter((stop) => stop.status === 'Completed'),
    [stops],
  );
  const wasteCollectedKg = useMemo(
    () => completedStops.reduce((total, stop) => total + stop.quantityKg, 0),
    [completedStops],
  );
  const completedCount = completedStops.length;
  const inProgressCount = useMemo(
    () => stops.filter((stop) => stop.status === 'In Progress').length,
    [stops],
  );
  const pendingCount = stops.length - completedCount;

  const travelledKm = activePlan
    ? Math.min(1, Math.max(0, progress)) * activePlan.distanceKm
    : 0;
  const remainingKm = activePlan
    ? Math.max(0, activePlan.distanceKm - travelledKm)
    : 0;

  const nextStopId = useMemo(() => {
    if (!activePlan || activePlan.distanceKm <= 0) {
      return null;
    }
    return (
      activePlan.stopOrder.find(
        (id) =>
          (activePlan.arrivalKm[id] ?? Number.POSITIVE_INFINITY) /
            activePlan.distanceKm >
          progress + 1e-7,
      ) ?? null
    );
  }, [activePlan, progress]);

  const nextStop = nextStopId ? stopById.get(nextStopId) ?? null : null;
  const nextStopEtaMin = useMemo(() => {
    if (!activePlan || !nextStopId) {
      return null;
    }
    return Math.max(
      0,
      (activePlan.arrivalMin[nextStopId] ?? 0) -
        activePlan.durationMin * Math.min(1, Math.max(0, progress)),
    );
  }, [activePlan, nextStopId, progress]);
  const nextStopDistanceKm = useMemo(() => {
    if (!activePlan || !nextStopId) {
      return null;
    }
    return Math.max(0, (activePlan.arrivalKm[nextStopId] ?? 0) - travelledKm);
  }, [activePlan, nextStopId, travelledKm]);

  const truckPosition = useMemo(
    () => (activePlan ? pointAtFraction(activePlan.geometry, progress) : null),
    [activePlan, progress],
  );

  const currentLocationLabel = useMemo(() => {
    if (!activePlan) {
      return 'Route not available';
    }
    if (progress <= 0) {
      return `At ${DEPOT.name}`;
    }
    if (progress >= 1) {
      return `Returned to ${DEPOT.name}`;
    }
    let cumulative = 0;
    for (let index = 0; index < activePlan.legs.length; index += 1) {
      const leg = activePlan.legs[index];
      cumulative += leg.distanceKm;
      if (travelledKm <= cumulative + 1e-6) {
        const from =
          leg.fromId === DEPOT_NODE
            ? DEPOT.name
            : stopById.get(leg.fromId)?.name ?? leg.fromId;
        const to =
          leg.toId === DEPOT_NODE
            ? DEPOT.name
            : stopById.get(leg.toId)?.name ?? leg.toId;
        return `Between ${from} and ${to}`;
      }
    }
    return `At ${DEPOT.name}`;
  }, [activePlan, progress, travelledKm, stopById]);

  const { onboardKg, unloadedKg } = useMemo(() => {
    if (!activePlan) {
      return { onboardKg: 0, unloadedKg: 0 };
    }
    let onboard = 0;
    let passedKm = 0;
    activePlan.order.forEach((nodeId, index) => {
      if (index > 0) {
        passedKm += activePlan.legs[index - 1]?.distanceKm ?? 0;
      }
      if (passedKm <= travelledKm + 1e-6) {
        if (nodeId === DEPOT_NODE) {
          onboard = 0;
        } else {
          onboard += stopById.get(nodeId)?.quantityKg ?? 0;
        }
      }
    });
    return {
      onboardKg: onboard,
      unloadedKg: Math.max(0, wasteCollectedKg - onboard),
    };
  }, [activePlan, travelledKm, stopById, wasteCollectedKg]);

  const activeCost = useMemo(
    () =>
      activePlan
        ? estimateOperatingCost(activePlan.distanceKm, settings)
        : { fuelCost: 0, maintenanceCost: 0, total: 0 },
    [activePlan, settings],
  );
  const travelledCost = useMemo(
    () => estimateOperatingCost(travelledKm, settings),
    [travelledKm, settings],
  );

  const resetAllPending = useCallback(() => {
    updateStops((previous) =>
      previous.some((stop) => stop.status !== 'Pending')
        ? previous.map((stop) => ({ ...stop, status: 'Pending' }))
        : previous,
    );
  }, [updateStops]);

  const startRoute = useCallback(() => {
    setFleet((prev) =>
      prev.map((truck) => ({ ...truck, status: 'running' })),
    );
    setSimulationStatus('running');
    notify('Real-time fleet tracking started.', 'success');
  }, [notify]);

  const pauseRoute = useCallback(() => {
    setFleet((prev) =>
      prev.map((truck) => ({ ...truck, status: 'paused' })),
    );
    setSimulationStatus('paused');
  }, []);

  const resumeRoute = useCallback(() => {
    setFleet((prev) =>
      prev.map((truck) => ({ ...truck, status: 'running' })),
    );
    setSimulationStatus('running');
  }, []);

  const advanceToNextStop = useCallback(() => {
    if (!activePlan || activePlan.distanceKm <= 0) {
      return;
    }
    const focusTruck =
      (selectedTruckId
        ? fleet.find((truck) => truck.id === selectedTruckId)
        : null) ??
      fleet.find((truck) => truck.planId === activePlanId) ??
      fleet[0];
    const upcoming = activePlan.stopOrder.find(
      (id) =>
        (activePlan.arrivalKm[id] ?? 0) / activePlan.distanceKm > progress + 1e-7,
    );
    if (!upcoming) {
      setProgress(1);
      if (focusTruck) {
        setFleet((previous) =>
          previous.map((truck) =>
            truck.id === focusTruck.id
              ? { ...truck, progress: 0.999, status: 'running' }
              : truck,
          ),
        );
      }
      return;
    }
    const fraction = Math.min(
      1,
      (activePlan.arrivalKm[upcoming] ?? 0) / activePlan.distanceKm + 1e-7,
    );
    setProgress(fraction);
    if (focusTruck) {
      setFleet((previous) =>
        previous.map((truck) =>
          truck.id === focusTruck.id
            ? {
                ...truck,
                progress: fraction,
                status:
                  simulationStatus === 'paused' ? 'paused' : 'running',
              }
            : truck,
        ),
      );
    }
  }, [
    activePlan,
    activePlanId,
    fleet,
    progress,
    selectedTruckId,
    simulationStatus,
  ]);

  const resetSimulation = useCallback(() => {
    setProgress(0);
    setSimulationStatus('running');
    setFleet((prev) =>
      prev.map((truck) => ({
        ...truck,
        progress: Math.random() * 0.2,
        status: 'running',
      })),
    );
    setSelectedTruckId(null);
    resetAllPending();
    notify('Fleet reset and restarted in real-time.', 'info');
  }, [resetAllPending, notify]);

  const fitRoute = useCallback(() => {
    setFitRequest((previous) => previous + 1);
  }, []);

  const revealRoute = useCallback(
    (id: RoutePlanId) => {
      setActivePlanIdState(id);
      setFitRequest((previous) => previous + 1);
      notify(
        `${id === 'baseline' ? 'Baseline' : 'Optimized'} route shown for this truck.`,
        'info',
      );
    },
    [notify],
  );

  const selectTruck = useCallback((id: string | null) => {
    setSelectedTruckId(id);
    if (id) {
      const truck = fleet.find((t) => t.id === id);
      if (truck) {
        setActivePlanIdState(truck.planId);
        setFitRequest((previous) => previous + 1);
      }
    }
  }, [fleet]);

  const retryRouting = useCallback(() => {
    clearRoutingCache();
    setRoutingNonce((previous) => previous + 1);
    notify('Retrying road routing…', 'info');
  }, [notify]);

  const optimizeRouteWithScope = useCallback((stopIds?: string[]) => {
    setRouteScopeIds(stopIds?.length ? stopIds : null);
    setOptimizeVersion((previous) => previous + 1);
    setActivePlanIdState('optimized');
    setSelectedTruckId(null);
    setProgress(0);
    setSimulationStatus('running');
    setFleet((previous) =>
      previous.map((truck) => ({ ...truck, status: 'running' })),
    );
    resetAllPending();
    notify(
      'Route re-optimized with capacity-aware nearest neighbour + 2-opt.',
      'success',
    );
  }, [resetAllPending, notify]);
  const optimizeRoute = useCallback(() => optimizeRouteWithScope(), [optimizeRouteWithScope]);
  const optimizeRouteForStops = useCallback(
    (stopIds: string[]) => optimizeRouteWithScope(stopIds),
    [optimizeRouteWithScope],
  );

  const startDriverTracking = useCallback(
    (truckName: string, position: LatLng, simulated: boolean) => {
      const activeIds = new Set(fleet.map((truck) => truck.id));
      if (driverTracking) activeIds.add(driverTracking.truckId);
      let sequence = 1;
      while (activeIds.has(`TRK-${String(sequence).padStart(2, '0')}`)) sequence += 1;
      const truckId = `TRK-${String(sequence).padStart(2, '0')}`;
      const tracking = { truckId, truckName, position, progress: 0, simulated, startedAt: Date.now() };
      driverTrackingRef.current = tracking;
      setDriverTracking(tracking);
      publishTrackingUpdate(tracking, 'POST');
      notify(`${truckId} navigation started. Live dashboard tracking is active.`, 'success');
      return truckId;
    },
    [fleet, driverTracking, notify],
  );
  const updateDriverTracking = useCallback(
    (position: LatLng, nextProgress: number, simulated: boolean, accuracyMeters?: number) => {
      const current = driverTrackingRef.current;
      if (!current) return;
      const tracking = {
        ...current,
        position,
        progress: Math.min(1, Math.max(current.progress, nextProgress)),
        simulated,
        accuracyMeters: simulated ? undefined : accuracyMeters,
        updatedAt: Date.now(),
      };
      driverTrackingRef.current = tracking;
      setDriverTracking(tracking);
      publishTrackingUpdate(tracking, 'POST');
    },
    [],
  );
  const stopDriverTracking = useCallback(() => {
    driverTrackingRef.current = null;
    setDriverTracking(null);
    publishTrackingUpdate(null, 'DELETE');
  }, []);

  const setActivePlanId = useCallback((id: RoutePlanId) => {
    setActivePlanIdState(id);
    setSelectedTruckId(null);
  }, []);

  const changeWasteMode = useCallback(
    (mode: WasteType) => {
      if (mode === wasteMode) {
        return;
      }
      setWasteMode(mode);
      setSelectedStopId(null);
      setSelectedTruckId(null);
      setProgress(0);
      setSimulationStatus('running');
      setFleet((previous) =>
        previous.map((truck) => ({ ...truck, status: 'running' })),
      );
      notify(`Loaded ${WASTE_MODE_META[mode].label} demo profile.`, 'info');
    },
    [wasteMode, notify],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => clampedSettings(patch, previous));
  }, []);

  const setCapacityKg = useCallback(
    (capacity: number) => {
      setSettings((previous) =>
        clampedSettings({ capacityKg: capacity }, previous),
      );
    },
    [],
  );

  const selectStop = useCallback((id: string | null) => {
    setSelectedStopId(id);
  }, []);

  const upsertStop = useCallback(
    (stop: Stop) => {
      updateStops((previous) => {
        const exists = previous.some((item) => item.id === stop.id);
        return exists
          ? previous.map((item) => (item.id === stop.id ? stop : item))
          : [...previous, stop];
      });
      setSelectedStopId(stop.id);
      notify(
        `${stop.name} saved. Route statistics are recalculating.`,
        'success',
      );
    },
    [updateStops, notify],
  );

  const removeStop = useCallback(
    (id: string) => {
      const target = stopById.get(id);
      updateStops((previous) => previous.filter((stop) => stop.id !== id));
      setSelectedStopId((previous) => (previous === id ? null : previous));
      notify(
        `${target?.name ?? 'Pickup stop'} removed from the simulated dataset.`,
        'info',
      );
    },
    [updateStops, stopById, notify],
  );

  const resetDemoData = useCallback(() => {
    const fresh = createInitialStopSets();
    setStopSets(fresh);
    setSettings({ ...DEFAULT_SETTINGS });
    setWasteMode('household');
    setSelectedStopId(null);
    setSelectedTruckId(null);
    setActivePlanIdState('baseline');
    setProgress(0);
    setSimulationStatus('idle');
    setFleet([]);
    setUserLocation(null);
    setGeoStatus('idle');
    setGeoMessage(null);
    setOptimizeVersion((previous) => previous + 1);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      setNotice(null);
    }
    notify('Demo data and assumptions restored.', 'success');
  }, [notify]);

  const requestGeolocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      setGeoMessage('This browser does not expose a geolocation API.');
      return;
    }
    setGeoStatus('requesting');
    setGeoMessage('Waiting for browser permission…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        setGeoStatus('granted');
        setGeoMessage(
          `Device location shared with permission (${location.lat.toFixed(
            4,
          )}, ${location.lng.toFixed(4)}). It is not a truck GPS feed.`,
        );
        notify('Device location added to the map.', 'success');
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setGeoStatus(denied ? 'denied' : 'error');
        setGeoMessage(
          denied
            ? 'Location permission was denied. The map continues without device location.'
            : 'Device location could not be determined. Try again in a browser with location enabled.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [notify]);

  const value: AppContextValue = {
    view,
    setView,
    stops,
    wasteMode,
    changeWasteMode,
    settings,
    updateSettings,
    setCapacityKg,
    selectedStopId,
    selectStop,
    updateStops,
    upsertStop,
    removeStop,
    resetDemoData,
    optimization,
    plans,
    routing,
    activePlanId,
    setActivePlanId,
    selectedTruckId,
    selectTruck,
    activePlan,
    revealRoute,
    fleet,
    fleetStatus: simulationStatus,
    retryRouting,
    optimizeRoute,
    optimizeRouteForStops,
    driverTracking,
    startDriverTracking,
    updateDriverTracking,
    stopDriverTracking,
    trackingConnected,
    simulationStatus,
    progress,
    startRoute,
    pauseRoute,
    resumeRoute,
    advanceToNextStop,
    resetSimulation,
    fitRoute,
    fitRequest,
    truckPosition,
    travelledKm,
    remainingKm,
    nextStopId,
    nextStop,
    nextStopEtaMin,
    nextStopDistanceKm,
    currentLocationLabel,
    wasteCollectedKg,
    totalWasteKg,
    completedCount,
    pendingCount,
    inProgressCount,
    activeCost,
    travelledCost,
    onboardKg,
    unloadedKg,
    userLocation,
    geoStatus,
    geoMessage,
    requestGeolocation,
    notice,
    notify,
    dismissNotice,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}

