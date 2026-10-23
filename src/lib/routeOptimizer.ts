import type {
  Accessibility,
  Depot,
  LatLng,
  OptimizationResult,
  Priority,
  RouteOrderPlan,
  Settings,
  Stop,
} from '../types';
import { haversineKm } from './geo';

export const DEPOT_NODE = 'DEPOT';
const ROAD_FACTOR = 1.32;
const PRIORITY_VALUE: Record<Priority, number> = {
  high: 1,
  medium: 0.5,
  low: 0,
};
const EPSILON = 1e-9;

export function accessibilityMultiplier(
  accessibility: Accessibility,
  steepPenaltyPct: number,
  narrowPenaltyPct: number,
): number {
  if (accessibility === 'restricted') {
    return 1 + steepPenaltyPct / 100;
  }
  if (accessibility === 'moderate') {
    return 1 + narrowPenaltyPct / 100;
  }
  return 1;
}

function stopFactor(stop: Stop, settings: Settings): number {
  return accessibilityMultiplier(
    stop.accessibility,
    settings.steepPenaltyPct,
    settings.narrowPenaltyPct,
  );
}

function legKm(from: LatLng, to: LatLng, destinationFactor: number): number {
  return haversineKm(from, to) * ROAD_FACTOR * destinationFactor;
}

function mapStops(stops: Stop[]): Map<string, Stop> {
  return new Map(stops.map((stop) => [stop.id, stop]));
}

function plainNearestNeighbor(stops: Stop[], depot: Depot): string[] {
  const remaining = [...stops];
  const order: string[] = [];
  let current: LatLng = depot;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, index) => {
      const distance = haversineKm(current, stop) * ROAD_FACTOR;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    order.push(next.id);
    current = next;
  }
  return order;
}

function pushDepotReturn(order: string[]): void {
  if (order.length === 0 || order[order.length - 1] !== DEPOT_NODE) {
    order.push(DEPOT_NODE);
  }
}

function capacityAwareOrder(
  stops: Stop[],
  depot: Depot,
  settings: Settings,
  priorityBias: number,
): string[] {
  const remaining = [...stops];
  const order: string[] = [DEPOT_NODE];
  let current: LatLng = depot;
  let load = 0;

  const resetAtDepot = () => {
    pushDepotReturn(order);
    load = 0;
    current = depot;
  };

  while (remaining.length > 0) {
    let pool = remaining.filter(
      (stop) => load + stop.quantityKg <= settings.capacityKg + EPSILON,
    );

    if (pool.length === 0) {
      if (load > EPSILON) {
        resetAtDepot();
        continue;
      }
      pool = remaining;
    }

    let chosen = pool[0];
    let chosenIndex = remaining.indexOf(chosen);
    let bestScore = Number.POSITIVE_INFINITY;

    pool.forEach((stop) => {
      const distance = legKm(current, stop, stopFactor(stop, settings));
      const urgency = Math.max(0.5, 1 - priorityBias * PRIORITY_VALUE[stop.priority]);
      const score = distance * urgency;
      if (score < bestScore) {
        bestScore = score;
        chosen = stop;
        chosenIndex = remaining.indexOf(stop);
      }
    });

    order.push(chosen.id);
    load += chosen.quantityKg;
    current = chosen;
    remaining.splice(chosenIndex, 1);

    if (load > settings.capacityKg + EPSILON) {
      resetAtDepot();
    }
  }

  pushDepotReturn(order);
  if (order.length === 1) {
    order.push(DEPOT_NODE);
  }
  return order;
}

function insertDepotReturns(
  stopOrder: string[],
  stopsById: Map<string, Stop>,
  capacityKg: number,
): string[] {
  const order: string[] = [DEPOT_NODE];
  let load = 0;
  stopOrder.forEach((id) => {
    const stop = stopsById.get(id);
    if (!stop) {
      return;
    }
    if (load > EPSILON && load + stop.quantityKg > capacityKg + EPSILON) {
      pushDepotReturn(order);
      load = 0;
    }
    order.push(id);
    load += stop.quantityKg;
    if (load > capacityKg + EPSILON) {
      pushDepotReturn(order);
      load = 0;
    }
  });
  pushDepotReturn(order);
  if (order.length === 1) {
    order.push(DEPOT_NODE);
  }
  return order;
}

function splitTrips(order: string[]): string[][] {
  const trips: string[][] = [];
  let current: string[] = [];
  order.forEach((id) => {
    if (id === DEPOT_NODE) {
      if (current.length > 0) {
        trips.push(current);
        current = [];
      }
      return;
    }
    current.push(id);
  });
  if (current.length > 0) {
    trips.push(current);
  }
  return trips;
}

function composeTrips(trips: string[][]): string[] {
  const order: string[] = [];
  trips.forEach((trip) => {
    if (trip.length === 0) {
      return;
    }
    order.push(DEPOT_NODE, ...trip);
  });
  order.push(DEPOT_NODE);
  return order;
}

function tripWeightedKm(
  trip: string[],
  stopsById: Map<string, Stop>,
  depot: Depot,
  settings: Settings,
): number {
  if (trip.length === 0) {
    return 0;
  }
  let total = 0;
  let previous: LatLng = depot;
  trip.forEach((id) => {
    const stop = stopsById.get(id);
    if (!stop) {
      return;
    }
    total += legKm(previous, stop, stopFactor(stop, settings));
    previous = stop;
  });
  total += legKm(previous, depot, 1);
  return total;
}

function improveTrip(
  trip: string[],
  stopsById: Map<string, Stop>,
  depot: Depot,
  settings: Settings,
): string[] {
  if (trip.length < 3) {
    return trip;
  }
  let best = [...trip];
  let bestCost = tripWeightedKm(best, stopsById, depot, settings);
  let improved = true;
  let passes = 0;

  while (improved && passes < 12) {
    improved = false;
    passes += 1;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const candidateCost = tripWeightedKm(candidate, stopsById, depot, settings);
        if (candidateCost < bestCost - 1e-7) {
          best = candidate;
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
  }
  return best;
}

function improveOrder(
  order: string[],
  stopsById: Map<string, Stop>,
  depot: Depot,
  settings: Settings,
): string[] {
  const trips = splitTrips(order).map((trip) =>
    improveTrip(trip, stopsById, depot, settings),
  );
  return composeTrips(trips);
}

function evaluateOrder(
  id: RouteOrderPlan['id'],
  label: string,
  order: string[],
  stopsById: Map<string, Stop>,
  depot: Depot,
  settings: Settings,
): RouteOrderPlan {
  let estimatedDistanceKm = 0;
  let previous: LatLng = depot;

  for (let i = 1; i < order.length; i += 1) {
    const nodeId = order[i];
    if (nodeId === DEPOT_NODE) {
      estimatedDistanceKm += legKm(previous, depot, 1);
      previous = depot;
      continue;
    }
    const stop = stopsById.get(nodeId);
    if (!stop) {
      continue;
    }
    estimatedDistanceKm += legKm(previous, stop, stopFactor(stop, settings));
    previous = stop;
  }

  const stopOrder = order.filter((nodeId) => nodeId !== DEPOT_NODE);
  const trips = splitTrips(order);
  const loads = trips.map((trip) =>
    trip.reduce((total, stopId) => total + (stopsById.get(stopId)?.quantityKg ?? 0), 0),
  );
  const maxTripLoadKg = loads.length > 0 ? Math.max(...loads) : 0;
  const totalLoadKg = stopOrder.reduce(
    (total, stopId) => total + (stopsById.get(stopId)?.quantityKg ?? 0),
    0,
  );
  const depotCount = order.filter((nodeId) => nodeId === DEPOT_NODE).length;
  const depotReturns = Math.max(0, depotCount - 2);

  return {
    id,
    label,
    order,
    stopOrder,
    estimatedDistanceKm,
    totalLoadKg,
    maxTripLoadKg,
    trips: trips.length,
    depotReturns,
    capacityFeasible: maxTripLoadKg <= settings.capacityKg + EPSILON,
  };
}

function isBetterCandidate(a: RouteOrderPlan, b: RouteOrderPlan): boolean {
  if (a.capacityFeasible !== b.capacityFeasible) {
    return a.capacityFeasible;
  }
  return a.estimatedDistanceKm < b.estimatedDistanceKm - 1e-7;
}

export function optimizeRoutes(
  stops: Stop[],
  settings: Settings,
  depot: Depot,
): OptimizationResult {
  const stopsById = mapStops(stops);
  const nearestNeighbor = plainNearestNeighbor(stops, depot);
  const baselineOrder = composeTrips([nearestNeighbor]);
  const baseline = evaluateOrder(
    'baseline',
    'Nearest neighbour',
    baselineOrder,
    stopsById,
    depot,
    settings,
  );

  const candidateOrders: string[][] = [];
  if (stops.length > 0) {
    const baselineWithReturns = insertDepotReturns(
      nearestNeighbor,
      stopsById,
      settings.capacityKg,
    );
    candidateOrders.push(improveOrder(baselineWithReturns, stopsById, depot, settings));
    candidateOrders.push(
      improveOrder(
        capacityAwareOrder(stops, depot, settings, 0),
        stopsById,
        depot,
        settings,
      ),
    );
    if (settings.priorityWeightPct > 0) {
      candidateOrders.push(
        improveOrder(
          capacityAwareOrder(
            stops,
            depot,
            settings,
            Math.min(0.4, settings.priorityWeightPct / 100),
          ),
          stopsById,
          depot,
          settings,
        ),
      );
    }
  }

  if (candidateOrders.length === 0) {
    candidateOrders.push(baselineOrder);
  }

  const candidates = candidateOrders.map((order) =>
    evaluateOrder(
      'optimized',
      'Capacity-aware + 2-opt',
      order,
      stopsById,
      depot,
      settings,
    ),
  );

  let optimized = candidates[0];
  for (let i = 1; i < candidates.length; i += 1) {
    if (isBetterCandidate(candidates[i], optimized)) {
      optimized = candidates[i];
    }
  }

  return { baseline, optimized };
}
