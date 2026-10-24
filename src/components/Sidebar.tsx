import {
  Apple,
  BarChart3,
  ChevronRight,
  Columns2,
  House,
  LayoutDashboard,
  Map,
  Mountain,
  PackageSearch,
  Route,
  Settings2,
  TreePine,
  Truck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { WASTE_MODE_META } from '../data/mockStops';
import { useApp } from '../store/AppStore';
import type { ViewId, WasteType } from '../types';
import { formatNumber } from '../lib/geo';
import { cn } from './ui';

const NAV_ITEMS: Array<{
  id: ViewId;
  label: string;
  icon: typeof LayoutDashboard;
  hint: string;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, hint: 'Control centre' },
  { id: 'map', label: 'Live Map', icon: Map, hint: 'Route map' },
  { id: 'planner', label: 'Route Planner', icon: Route, hint: 'Optimizer' },
  {
    id: 'compare',
    label: 'Basline vs optimized route',
    icon: Columns2,
    hint: 'Side-by-side maps',
  },
  { id: 'stops', label: 'Pickup Stops', icon: PackageSearch, hint: '10 stops' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hint: 'Collection data' },
  { id: 'settings', label: 'Settings', icon: Settings2, hint: 'Assumptions' },
];

const MODE_ICONS: Record<WasteType, typeof House> = {
  household: House,
  pine: TreePine,
  fruit: Apple,
};

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    view,
    setView,
    wasteMode,
    changeWasteMode,
    settings,
    setCapacityKg,
    routing,
    stops,
  } = useApp();

  const routingLabel = routing.loading
    ? 'Checking road routing…'
    : routing.source === 'osrm'
      ? 'Road-network routing'
      : routing.source === 'mixed'
        ? 'Partial road route'
        : routing.source === 'simulated'
          ? 'Simulated fallback'
          : 'Awaiting route';

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-hidden border-r border-white/10 bg-forest-950/90 text-forest-100 shadow-2xl backdrop-blur-2xl transition-transform duration-200 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
      aria-label="Primary navigation"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.18]" />
      <div className="relative flex h-[72px] shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600 text-white shadow-lg shadow-forest-950/40">
          <Mountain className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold leading-tight text-white">
            Himalaya Route
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-forest-300">
            Waste Logistics
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-forest-200 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-400">
          Workspace
        </p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  onClose();
                }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                  active
                    ? 'bg-forest-50 text-forest-950 shadow-sm'
                    : 'text-forest-200 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition',
                    active
                      ? 'bg-forest-700 text-white'
                      : 'bg-white/5 text-forest-300 group-hover:bg-white/10 group-hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-tight">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      'block text-[10px] leading-tight',
                      active ? 'text-forest-600' : 'text-forest-400',
                    )}
                  >
                    {item.id === 'stops'
                      ? `${stops.length} simulated stops`
                      : item.hint}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 transition',
                    active ? 'text-forest-500' : 'text-forest-600',
                  )}
                />
              </button>
            );
          })}
        </nav>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-300">
              Collection mode
            </p>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-forest-200">
              Demo
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(WASTE_MODE_META) as WasteType[]).map((mode) => {
              const Icon = MODE_ICONS[mode];
              const active = wasteMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeWasteMode(mode)}
                  title={WASTE_MODE_META[mode].description}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-semibold transition',
                    active
                      ? 'border-forest-300/60 bg-forest-100 text-forest-900'
                      : 'border-white/10 bg-white/[0.03] text-forest-300 hover:border-white/20 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {WASTE_MODE_META[mode].shortLabel}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-forest-400">
            {WASTE_MODE_META[wasteMode].description}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-300">
              Truck capacity
            </p>
            <span className="font-mono text-[11px] font-semibold text-white">
              {formatNumber(settings.capacityKg)} kg
            </span>
          </div>
          <input
            type="range"
            min={500}
            max={2000}
            step={50}
            value={settings.capacityKg}
            onChange={(event) => setCapacityKg(Number(event.target.value))}
            className="mt-2 w-full"
            aria-label="Truck capacity in kilograms"
          />
          <div className="mt-1 flex justify-between text-[9px] text-forest-500">
            <span>500 kg</span>
            <span>2,000 kg</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-forest-400">
            Capacity-aware planning inserts a depot unload before a load would
            exceed this limit.
          </p>
        </div>
      </div>

      <div className="relative shrink-0 border-t border-white/10 bg-forest-950/80 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2">
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              routing.source === 'osrm'
                ? 'bg-emerald-400/15 text-emerald-300'
                : 'bg-amber-400/15 text-amber-300',
            )}
          >
            {routing.source === 'osrm' ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold text-forest-100">
              {routingLabel}
            </p>
            <p className="text-[9px] text-forest-400">
              Simulated pickups • no live GPS
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 px-1 text-[9px] text-forest-500">
          <Truck className="h-3 w-3" />
          <span>UK mountain fleet • demo v1.0</span>
        </div>
      </div>
    </aside>
  );
}
