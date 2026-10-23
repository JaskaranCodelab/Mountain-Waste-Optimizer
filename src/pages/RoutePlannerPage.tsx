import {
  Gauge,
  Info,
  Route as RouteIcon,
  Sparkles,
  Truck,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import { formatKm, formatNumber } from '../lib/geo';
import { RouteComparison } from '../components/RouteComparison';
import { RouteControls } from '../components/RouteControls';
import { RouteStopList } from '../components/RouteStopList';
import { UttarakhandMap } from '../components/UttarakhandMap';
import {
  Badge,
  Card,
  InfoNote,
  SectionHeader,
} from '../components/ui';

export function RoutePlannerPage() {
  const { activePlan, optimization, settings, routing, fitRoute } = useApp();

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Route planner"
        title="Capacity-aware route optimization"
        subtitle="Compare the plain nearest-neighbour baseline with the optimized plan. Tune capacity and mountain penalties to see how the sequence changes."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="violet">
              <Sparkles className="h-2.5 w-2.5" />
              Heuristic · not ML
            </Badge>
            <Badge tone={routing.source === 'osrm' ? 'blue' : 'amber'}>
              {routing.source === 'osrm' ? 'Road-network data' : 'Fallback estimate'}
            </Badge>
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-50 text-forest-700">
              <RouteIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">
                Planning controls
              </p>
              <p className="text-[10px] text-slate-400">
                Run the simulation, switch plans or recalculate the heuristic.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="forest">
              <Truck className="h-2.5 w-2.5" />
              {formatNumber(settings.capacityKg)} kg
            </Badge>
            <Badge tone="slate">
              <Gauge className="h-2.5 w-2.5" />
              {activePlan
                ? `${formatKm(activePlan.distanceKm)} • ${formatNumber(
                    activePlan.totalLoadKg,
                  )} kg total`
                : 'Route loading'}
            </Badge>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <RouteControls />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(350px,1fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="font-display text-sm font-semibold text-slate-900">
                  Active plan on the map
                </p>
                <p className="text-[10px] text-slate-400">
                  Toggle between baseline and optimized in the comparison panel.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="slate">
                  {optimization.optimized.stopOrder.length} pickups
                </Badge>
                <Badge tone="slate">
                  {optimization.optimized.depotReturns} depot return
                  {optimization.optimized.depotReturns === 1 ? '' : 's'}
                </Badge>
                <button
                  type="button"
                  onClick={fitRoute}
                  className="text-[10px] font-semibold text-forest-700 hover:text-forest-900"
                >
                  Fit route
                </button>
              </div>
            </div>
            <div className="p-2.5">
              <UttarakhandMap heightClass="h-[540px]" />
            </div>
          </Card>

          <RouteStopList />
        </div>

        <div className="space-y-4">
          <RouteComparison />
          <InfoNote
            tone="blue"
            icon={<Info className="h-3.5 w-3.5" />}
          >
            The optimized sequence is produced locally with a greedy
            capacity-aware nearest-neighbour seed, priority weighting and 2-opt
            swaps. It is deterministic for the current stop set and assumptions,
            but it is not a globally optimal solver.
          </InfoNote>
        </div>
      </div>
    </div>
  );
}
