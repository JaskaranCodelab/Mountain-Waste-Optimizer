import type { CostBreakdown, Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  capacityKg: 1500,
  fuelEfficiencyKmPerL: 6,
  fuelPricePerL: 96.72,
  maintenanceCostPerKm: 9,
  steepPenaltyPct: 15,
  narrowPenaltyPct: 22,
  priorityWeightPct: 12,
  simulationIntervalMs: 700,
  simulationStepPct: 0.06,
  routingProvider: 'osrm',
};

export const CAPACITY_MIN_KG = 500;
export const CAPACITY_MAX_KG = 2000;

export function estimateOperatingCost(
  distanceKm: number,
  settings: Settings,
): CostBreakdown {
  const safeDistance = Math.max(0, distanceKm);
  const fuelCost =
    (safeDistance / Math.max(0.1, settings.fuelEfficiencyKmPerL)) *
    settings.fuelPricePerL;
  const maintenanceCost = safeDistance * settings.maintenanceCostPerKm;
  return {
    fuelCost,
    maintenanceCost,
    total: fuelCost + maintenanceCost,
  };
}

export function costPerKm(settings: Settings): number {
  return (
    settings.fuelPricePerL / Math.max(0.1, settings.fuelEfficiencyKmPerL) +
    settings.maintenanceCostPerKm
  );
}

export function clampedSettings(patch: Partial<Settings>, base: Settings): Settings {
  const next = { ...base, ...patch };
  return {
    ...next,
    capacityKg: Math.min(CAPACITY_MAX_KG, Math.max(CAPACITY_MIN_KG, next.capacityKg)),
    fuelEfficiencyKmPerL: Math.min(12, Math.max(2, next.fuelEfficiencyKmPerL)),
    fuelPricePerL: Math.min(200, Math.max(40, next.fuelPricePerL)),
    maintenanceCostPerKm: Math.min(50, Math.max(0, next.maintenanceCostPerKm)),
    steepPenaltyPct: Math.min(60, Math.max(0, next.steepPenaltyPct)),
    narrowPenaltyPct: Math.min(60, Math.max(0, next.narrowPenaltyPct)),
    priorityWeightPct: Math.min(40, Math.max(0, next.priorityWeightPct)),
    simulationIntervalMs: Math.min(2000, Math.max(100, next.simulationIntervalMs)),
    simulationStepPct: Math.min(3, Math.max(0.02, next.simulationStepPct)),
  };
}
