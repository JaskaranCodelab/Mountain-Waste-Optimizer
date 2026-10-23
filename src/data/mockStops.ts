import type { Accessibility, Depot, Priority, Stop, WasteType } from '../types';

export const DEPOT: Depot = {
  id: 'DEPOT',
  name: 'Mussoorie Collection Depot',
  area: 'Barlow Ganj, Mussoorie',
  lat: 30.446560327274955,
  lng: 78.0758601571972,
};

interface StopSeed {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  accessibility: Accessibility;
  serviceTimeMin: number;
  baseKg: number;
  basePriority: Priority;
  zone: string;
}

interface ModeProfile {
  label: string;
  shortLabel: string;
  description: string;
  defaultType: WasteType;
  multipliers: Record<string, number>;
  priorities: Record<string, Priority>;
  typeOverrides: Record<string, WasteType>;
  accent: string;
}

const SEEDS: StopSeed[] = [
  {
    id: 'S1',
    name: 'Mussoorie Library Chowk',
    area: 'Mall Road, Mussoorie',
    lat: 30.459743923560147,
    lng: 78.06448514093601,
    accessibility: 'moderate',
    serviceTimeMin: 15,
    baseKg: 180,
    basePriority: 'high',
    zone: 'Mall Road market and library cluster',
  },
  {
    id: 'S2',
    name: 'Landour Bazaar',
    area: 'Landour, Mussoorie',
    lat: 30.456950636280435,
    lng: 78.10215233951608,
    accessibility: 'moderate',
    serviceTimeMin: 11,
    baseKg: 120,
    basePriority: 'medium',
    zone: 'Landour heritage bazaar',
  },
  {
    id: 'S3',
    name: 'Kulri Bazaar',
    area: 'Kulri, Mussoorie',
    lat: 30.455359937979193,
    lng: 78.07921424465513,
    accessibility: 'moderate',
    serviceTimeMin: 16,
    baseKg: 200,
    basePriority: 'high',
    zone: 'Kulri market and Mall Road shops',
  },
  {
    id: 'S4',
    name: 'Picture Palace area',
    area: 'Kulri, Mussoorie',
    lat: 30.45353839702272,
    lng: 78.08324867215141,
    accessibility: 'moderate',
    serviceTimeMin: 13,
    baseKg: 150,
    basePriority: 'high',
    zone: 'Picture Palace visitor and parking area',
  },
  {
    id: 'S5',
    name: 'Company Garden area',
    area: 'Company Garden, Mussoorie',
    lat: 30.461014335375626,
    lng: 78.05359661747084,
    accessibility: 'easy',
    serviceTimeMin: 10,
    baseKg: 100,
    basePriority: 'medium',
    zone: 'Company Garden tourist area',
  },
  {
    id: 'S6',
    name: 'Happy Valley',
    area: 'Happy Valley, Mussoorie',
    lat: 30.472429806896063,
    lng: 78.0497345895849,
    accessibility: 'moderate',
    serviceTimeMin: 9,
    baseKg: 90,
    basePriority: 'medium',
    zone: 'Happy Valley settlement and monastery',
  },
  {
    id: 'S7',
    name: 'Barlow Ganj',
    area: 'Barlow Ganj, Mussoorie',
    lat: 30.44614409401494,
    lng: 78.07927293879284,
    accessibility: 'moderate',
    serviceTimeMin: 13,
    baseKg: 160,
    basePriority: 'high',
    zone: 'Barlow Ganj hillside settlement',
  },
  {
    id: 'S8',
    name: 'Landour Clock Tower',
    area: 'Landour, Mussoorie',
    lat: 30.455460704611838,
    lng: 78.08672493110983,
    accessibility: 'moderate',
    serviceTimeMin: 8,
    baseKg: 110,
    basePriority: 'medium',
    zone: 'Landour clock tower and ridge access',
  },
  {
    id: 'S9',
    name: 'Lal Tibba',
    area: 'Lal Tibba, Mussoorie',
    lat: 30.466736180165785,
    lng: 78.0949719374955,
    accessibility: 'restricted',
    serviceTimeMin: 12,
    baseKg: 140,
    basePriority: 'high',
    zone: 'Lal Tibba ridge viewpoint',
  },
  {
    id: 'S10',
    name: 'George Everest Area',
    area: 'George Everest, Mussoorie',
    lat: 30.45934964192945,
    lng: 78.03535759510979,
    accessibility: 'restricted',
    serviceTimeMin: 10,
    baseKg: 110,
    basePriority: 'medium',
    zone: 'George Everest heritage area',
  },
];

const MODE_PROFILES: Record<WasteType, ModeProfile> = {
  household: {
    label: 'Household Waste',
    shortLabel: 'Household',
    description:
      "Mixed municipal collection across Mussoorie's Mall Road, Landour, Happy Valley and surrounding hills. High-priority bazaar stops drive the sequence.",
    defaultType: 'household',
    multipliers: {},
    priorities: {},
    typeOverrides: {},
    accent: '#2f8058',
  },
  pine: {
    label: 'Pine Needles',
    shortLabel: 'Pine',
    description:
      'Dry pine-needle feedstock gathered from Landour, Barlow Ganj, Lal Tibba and George Everest forest edges; Mall Road stops keep household loads.',
    defaultType: 'pine',
    multipliers: {
      S1: 0.6,
      S2: 1.7,
      S3: 0.7,
      S4: 0.6,
      S5: 1.4,
      S6: 1.3,
      S7: 2,
      S8: 2.2,
      S9: 1.9,
      S10: 2,
    },
    priorities: {
      S1: 'medium',
      S2: 'high',
      S3: 'medium',
      S4: 'low',
      S5: 'medium',
      S6: 'medium',
      S7: 'high',
      S8: 'high',
      S9: 'high',
      S10: 'high',
    },
    typeOverrides: {
      S1: 'household',
      S3: 'household',
      S4: 'household',
      S5: 'household',
      S6: 'household',
    },
    accent: '#a16207',
  },
  fruit: {
    label: 'Fruit Peels',
    shortLabel: 'Fruit',
    description:
      'Market fruit-peel collection concentrated around Library Chowk, Kulri Bazaar and Picture Palace; outlying hill stops keep lighter loads.',
    defaultType: 'fruit',
    multipliers: {
      S1: 1.6,
      S2: 0.8,
      S3: 1.8,
      S4: 1.7,
      S5: 1.2,
      S6: 0.9,
      S7: 0.6,
      S8: 0.5,
      S9: 0.7,
      S10: 0.6,
    },
    priorities: {
      S1: 'high',
      S2: 'medium',
      S3: 'high',
      S4: 'high',
      S5: 'medium',
      S6: 'low',
      S7: 'medium',
      S8: 'low',
      S9: 'medium',
      S10: 'low',
    },
    typeOverrides: {
      S2: 'household',
      S7: 'household',
      S8: 'pine',
      S9: 'pine',
      S10: 'pine',
    },
    accent: '#c2410c',
  },
};

function roundToFive(value: number): number {
  return Math.max(10, Math.round(value / 5) * 5);
}

export function createStopsForMode(mode: WasteType): Stop[] {
  const profile = MODE_PROFILES[mode];
  return SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    area: seed.area,
    lat: seed.lat,
    lng: seed.lng,
    wasteType: profile.typeOverrides[seed.id] ?? profile.defaultType,
    quantityKg: roundToFive(seed.baseKg * (profile.multipliers[seed.id] ?? 1)),
    priority: profile.priorities[seed.id] ?? seed.basePriority,
    status: 'Pending',
    serviceTimeMin: seed.serviceTimeMin,
    accessibility: seed.accessibility,
    note: `${seed.zone} • simulated demo record`,
  }));
}

export function createInitialStopSets(): Record<WasteType, Stop[]> {
  return {
    household: createStopsForMode('household'),
    pine: createStopsForMode('pine'),
    fruit: createStopsForMode('fruit'),
  };
}

export const WASTE_MODE_META: Record<
  WasteType,
  { label: string; shortLabel: string; description: string; accent: string }
> = {
  household: {
    label: MODE_PROFILES.household.label,
    shortLabel: MODE_PROFILES.household.shortLabel,
    description: MODE_PROFILES.household.description,
    accent: MODE_PROFILES.household.accent,
  },
  pine: {
    label: MODE_PROFILES.pine.label,
    shortLabel: MODE_PROFILES.pine.shortLabel,
    description: MODE_PROFILES.pine.description,
    accent: MODE_PROFILES.pine.accent,
  },
  fruit: {
    label: MODE_PROFILES.fruit.label,
    shortLabel: MODE_PROFILES.fruit.shortLabel,
    description: MODE_PROFILES.fruit.description,
    accent: MODE_PROFILES.fruit.accent,
  },
};

export const WASTE_TYPE_META: Record<
  WasteType,
  { label: string; shortLabel: string; color: string }
> = {
  household: { label: 'Household Waste', shortLabel: 'Household', color: '#2f8058' },
  pine: { label: 'Pine Needles', shortLabel: 'Pine', color: '#a16207' },
  fruit: { label: 'Fruit Peels', shortLabel: 'Fruit', color: '#c2410c' },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; rank: number }
> = {
  high: { label: 'High', color: '#dc2626', rank: 3 },
  medium: { label: 'Medium', color: '#d97706', rank: 2 },
  low: { label: 'Low', color: '#0f766e', rank: 1 },
};

export const ACCESSIBILITY_META: Record<Accessibility, { label: string }> = {
  easy: { label: 'Easy' },
  moderate: { label: 'Moderate' },
  restricted: { label: 'Restricted' },
};

export const DEMO_STOP_COUNT = SEEDS.length;
