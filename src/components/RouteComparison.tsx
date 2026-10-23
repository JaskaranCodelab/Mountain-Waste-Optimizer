import {
  AlertTriangle,
  CheckCircle2,
  Fuel,
  IndianRupee,
  Map,
  Route as RouteIcon,
  RotateCw,
  Sparkles,
  Truck,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import type { RoutePlan } from '../types';
import { estimateOperatingCost } from '../lib/costCalculator';
import {
  formatCurrency,
  formatDuration,
  formatKm,
  formatNumber,
  formatPercent,
} from '../lib/geo';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InfoNote,
  ProgressBar,
  SectionHeader,
  cn,
} from './ui';

export function RouteComparison({ className }: { className?: string }) {
  const {
    plans,
    routing,
    settings,
    optimization,
    activePlanId,
    setActivePlanId,
    retryRouting,
  } = useApp();

  const baseline = plans.baseline;
  const optimized = plans.optimized;

  if (!baseline || !optimized) {
    if (routing.loading) {
      return (
        <Card className={cn('space-y-3 p-4', className)}>
          <SectionHeader
            eyebrow="Optimizer"
            title="Baseline vs optimized route"
            subtitle="Comparing nearest-neighbour with capacity-aware + 2-opt."
          />
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
        </Card>
      );
    }
    return (
      <Card className={cn('p-4', className)}>
        <EmptyState
          icon={<WifiOff className="h-4 w-4" />}
          title="No route comparison yet"
          description="Add pickup stops to generate a baseline and optimized sequence."
        />
      </Card>
    );
  }

  const baselineCost = estimateOperatingCost(baseline.distanceKm, settings);
  const optimizedCost = estimateOperatingCost(optimized.distanceKm, settings);
  const savedKm = baseline.distanceKm - optimized.distanceKm;
  const savedPct =
    baseline.distanceKm > 0 ? (savedKm / baseline.distanceKm) * 100 : 0;
  const fuelSaved = baselineCost.fuelCost - optimizedCost.fuelCost;
  const operatingSaved = baselineCost.total - optimizedCost.total;
  const positive = savedKm >= 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="border-b border-slate-100 px-4 py-4">
        <SectionHeader
          eyebrow="Route optimization"
          title="Baseline vs optimized"
          subtitle="Transparent heuristics for mountain collection — not a trained AI model."
          action={
            <Badge
              tone={
                routing.source === 'osrm'
                  ? 'blue'
                  : routing.source === 'simulated'
                    ? 'amber'
                    : 'violet'
              }
            >
              {routing.loading
                ? 'Refreshing…'
                : routing.source === 'osrm'
                  ? 'Road distances'
                  : routing.source === 'mixed'
                    ? 'Mixed route source'
                    : 'Simulated distances'}
            </Badge>
          }
        />
        {routing.loading ? (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/3 animate-pulse bg-forest-500" />
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        <div
          className={cn(
            'rounded-2xl border p-4',
            positive
              ? 'border-forest-200 bg-gradient-to-br from-forest-50 via-white to-emerald-50/60'
              : 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50/60',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-700">
                {positive ? 'Distance saved' : 'Capacity trade-off'}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">
                {positive ? '' : '+'}
                {formatKm(Math.abs(savedKm))}
              </p>
              <p className="text-xs text-slate-500">
                {positive ? '' : 'Capacity-aware planning adds '}
                {formatPercent(Math.abs(savedPct), 1)}{' '}
                {positive ? 'reduction' : 'distance'} vs baseline
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <SavingsChip
                icon={<Fuel className="h-3.5 w-3.5" />}
                label={positive ? 'Fuel saved' : 'Fuel delta'}
                value={formatCurrency(fuelSaved)}
              />
              <SavingsChip
                icon={<IndianRupee className="h-3.5 w-3.5" />}
                label={positive ? 'Op. cost saved' : 'Op. cost delta'}
                value={formatCurrency(operatingSaved)}
              />
              <SavingsChip
                icon={<Truck className="h-3.5 w-3.5" />}
                label="Capacity use"
                value={formatPercent(optimized.capacityUtilizationPct, 0)}
              />
              <SavingsChip
                icon={<RouteIcon className="h-3.5 w-3.5" />}
                label="Depot returns"
                value={formatNumber(optimized.depotReturns)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PlanCard
            plan={baseline}
            active={activePlanId === 'baseline'}
            onSelect={() => setActivePlanId('baseline')}
            cost={baselineCost.total}
            emphasis="Baseline"
            capacityKg={settings.capacityKg}
            description="Plain nearest-neighbour, no capacity or mountain penalties."
          />
          <PlanCard
            plan={optimized}
            active={activePlanId === 'optimized'}
            onSelect={() => setActivePlanId('optimized')}
            cost={optimizedCost.total}
            emphasis="Optimized"
            capacityKg={settings.capacityKg}
            description="Capacity-aware greedy + priority bias + 2-opt improvements."
          />
        </div>

        {!baseline.capacityFeasible ? (
          <InfoNote tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            Baseline ignores capacity: total load{' '}
            {formatNumber(baseline.totalLoadKg)} kg exceeds truck capacity{' '}
            {formatNumber(settings.capacityKg)} kg. The optimized plan inserts{' '}
            {optimized.depotReturns} depot unload(s).
          </InfoNote>
        ) : null}

        {routing.error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="flex items-start gap-2 text-xs text-amber-800">
              <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Road routing degraded</p>
                <p className="mt-0.5 leading-5 text-amber-700">
                  {routing.error}. The simulation continues with clearly
                  labelled simulated geometry.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={retryRouting}>
                <RotateCw className="h-3 w-3" />
                Retry routing
              </Button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-[10px] leading-4 text-slate-500">
          Heuristic weights: restricted access{' '}
          <span className="font-semibold text-slate-700">
            +{settings.steepPenaltyPct}%
          </span>
          , moderate access{' '}
          <span className="font-semibold text-slate-700">
            +{settings.narrowPenaltyPct}%
          </span>
          , priority bonus{' '}
          <span className="font-semibold text-slate-700">
            {settings.priorityWeightPct}%
          </span>
          . Optimizer candidate orders:{' '}
          <span className="font-semibold text-slate-700">
            {optimization.optimized.stopOrder.length} stops
          </span>
          . Road geometry from OpenStreetMap routing when available; otherwise simulated
          estimates are shown with an explicit label.
        </div>
      </div>
    </Card>
  );
}

function PlanCard({
  plan,
  active,
  onSelect,
  cost,
  emphasis,
  description,
  capacityKg,
}: {
  plan: RoutePlan;
  active: boolean;
  onSelect: () => void;
  cost: number;
  emphasis: string;
  description: string;
  capacityKg: number;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3.5 transition',
        active
          ? 'border-forest-400 bg-forest-50/50 ring-1 ring-forest-200'
          : 'border-slate-200 bg-white hover:border-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display text-sm font-semibold text-slate-900">
              {plan.label}
            </p>
            {emphasis === 'Optimized' ? (
              <Sparkles className="h-3.5 w-3.5 text-forest-600" />
            ) : null}
          </div>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
            {description}
          </p>
        </div>
        <Badge tone={plan.simulated ? 'amber' : 'blue'}>
          {plan.simulated ? 'Simulated' : 'Road'}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Distance
          </p>
          <p className="mt-0.5 font-display text-base font-semibold text-slate-900">
            {formatKm(plan.distanceKm)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Est. cost
          </p>
          <p className="mt-0.5 font-display text-base font-semibold text-slate-900">
            {formatCurrency(cost)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Capacity utilization</span>
          <span
            className={cn(
              'font-semibold',
              plan.capacityFeasible ? 'text-forest-700' : 'text-red-600',
            )}
          >
            {formatPercent(plan.capacityUtilizationPct, 0)} (
            {formatNumber(plan.maxTripLoadKg)}/{formatNumber(capacityKg)} kg)
          </span>
        </div>
        <ProgressBar
          value={plan.capacityUtilizationPct}
          tone={plan.capacityFeasible ? 'forest' : 'red'}
          className="h-1.5"
        />
        <div className="grid grid-cols-3 gap-1 text-center text-[9px] text-slate-500">
          <div className="rounded-lg bg-slate-50 px-1 py-1.5">
            <p className="font-semibold text-slate-700">
              {formatDuration(plan.durationMin)}
            </p>
            drive
          </div>
          <div className="rounded-lg bg-slate-50 px-1 py-1.5">
            <p className="font-semibold text-slate-700">{plan.trips}</p>
            trip{plan.trips === 1 ? '' : 's'}
          </div>
          <div className="rounded-lg bg-slate-50 px-1 py-1.5">
            <p className="font-semibold text-slate-700">{plan.depotReturns}</p>
            unload{plan.depotReturns === 1 ? '' : 's'}
          </div>
        </div>
        {!plan.capacityFeasible ? (
          <p className="flex items-start gap-1 text-[9px] font-medium leading-4 text-red-600">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Exceeds {formatNumber(capacityKg)} kg capacity. Increase capacity or
            use the optimized route.
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[9px] font-medium text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Capacity-feasible with depot return logic
          </p>
        )}
      </div>

      <Button
        variant={active ? 'secondary' : 'outline'}
        size="sm"
        className="mt-3 w-full"
        onClick={onSelect}
        aria-pressed={active}
      >
        {active ? (
          <>
            <Map className="h-3 w-3" />
            Active on map
          </>
        ) : (
          <>Use this route on map</>
        )}
      </Button>
    </div>
  );
}

function SavingsChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 shadow-sm">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="text-forest-600">{icon}</span>
        {label}
      </p>
      <p className="font-mono text-[11px] font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}
