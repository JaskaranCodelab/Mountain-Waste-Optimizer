export type WasteType = 'household' | 'pine' | 'fruit';

export type Priority = 'high' | 'medium' | 'low';

export type StopStatus = 'Pending' | 'In Progress' | 'Completed';

export type Accessibility = 'easy' | 'moderate' | 'restricted';

export type ViewId =
  | 'overview'
  | 'map'
  | 'planner'
  | 'compare'
  | 'stops'
  | 'analytics'
  | 'settings';

export type RoutePlanId = 'baseline' | 'optimized';

export type RoutingProvider = 'osrm' | 'simulated';

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'complete';

export interface FleetTruck {
  id: string;
  name: string;
  type: string;
  capacityKg: number;
  fuel: string;
  bestFor: string;
  planId: RoutePlanId;
  progress: number;
  status: SimulationStatus;
  speedPct: number;
  color: string;
  assignedStops: string[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Depot extends LatLng {
  id: string;
  name: string;
  area: string;
}

export interface Stop extends LatLng {
  id: string;
  name: string;
  area: string;
  wasteType: WasteType;
  quantityKg: number;
  /** Demo visualization of the bin's fill level from 0 to 100 percent. */
  fillPercent?: number;
  /** Set only when a driver confirms the truck emptied this bin. */
  emptiedByDriver?: boolean;
  priority: Priority;
  status: StopStatus;
  serviceTimeMin: number;
  accessibility: Accessibility;
  note: string;
}

export interface Settings {
  capacityKg: number;
  fuelEfficiencyKmPerL: number;
  fuelPricePerL: number;
  maintenanceCostPerKm: number;
  steepPenaltyPct: number;
  narrowPenaltyPct: number;
  priorityWeightPct: number;
  simulationIntervalMs: number;
  simulationStepPct: number;
  routingProvider: RoutingProvider;
}

export interface RouteLeg {
  fromId: string;
  toId: string;
  distanceKm: number;
  durationMin: number;
}

export interface RoutePlan {
  id: RoutePlanId;
  label: string;
  order: string[];
  stopOrder: string[];
  geometry: LatLng[];
  distanceKm: number;
  durationMin: number;
  legs: RouteLeg[];
  arrivalKm: Record<string, number>;
  arrivalMin: Record<string, number>;
  simulated: boolean;
  provider: string;
  depotReturns: number;
  trips: number;
  totalLoadKg: number;
  maxTripLoadKg: number;
  capacityUtilizationPct: number;
  capacityFeasible: boolean;
}

export interface RoutePlanSet {
  baseline: RoutePlan | null;
  optimized: RoutePlan | null;
}

export type RoutingSource = 'osrm' | 'simulated' | 'mixed' | 'pending';

export interface RoutingMeta {
  loading: boolean;
  error: string | null;
  source: RoutingSource;
  updatedAt: number | null;
}

export interface CostBreakdown {
  fuelCost: number;
  maintenanceCost: number;
  total: number;
}

export interface RouteOrderPlan {
  id: RoutePlanId;
  label: string;
  order: string[];
  stopOrder: string[];
  estimatedDistanceKm: number;
  totalLoadKg: number;
  maxTripLoadKg: number;
  trips: number;
  depotReturns: number;
  capacityFeasible: boolean;
}

export interface OptimizationResult {
  baseline: RouteOrderPlan;
  optimized: RouteOrderPlan;
}
