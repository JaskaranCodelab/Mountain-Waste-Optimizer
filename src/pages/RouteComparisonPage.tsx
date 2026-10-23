import {
  ArrowRight,
  Clock3,
  Fuel,
  Map as MapIcon,
  Route as RouteIcon,
  Sparkles,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import type { RoutePlan, RoutePlanId } from '../types';
import { DEPOT } from '../data/mockStops';
import { estimateOperatingCost } from '../lib/costCalculator';
import {
  formatCurrency,
  formatDuration,
  formatKm,
  formatNumber,
  formatPercent,
} from '../lib/geo';
import { UttarakhandMap } from '../components/UttarakhandMap';
import {
  Badge,
  Button,
  Card,
  InfoNote,
  SectionHeader,
  cn,
} from '../components/ui';

export function RouteComparisonPage() {
  const {
    plans,
    settings,
    routing,
    activePlanId,
    setActivePlanId,
    simulationStatus,
  } = useApp();

  const baseline = plans.baseline;
  const optimized = plans.optimized;

  if (!baseline || !optimized) {
    return (
      <div className="space-y-4">
        <SectionHeader
          eyebrow="Route comparison"
          title="Baseline vs optimized routes"
          subtitle="Two plans over the same dustbin network, shown side by side."
        />
        <Card className="p-4">
          <div className="skeleton h-[360px] rounded-xl" />
          <p className="mt-3 text-center text-[11px] text-slate-400">
            {routing.loading
              ? 'Loading road geometry for both plans…'
              : 'Add pickup stops to generate a comparison.'}
          </p>
        </Card>
      </div>
    );
  }

  const baselineCost = estimateOperatingCost(baseline.distanceKm, settings);
  const optimizedCost = estimateOperatingCost(optimized.distanceKm, settings);
  const savedKm = baseline.distanceKm - optimized.distanceKm;
  const savedCost = baselineCost.total - optimizedCost.total;
  const savedPct =
    baseline.distanceKm > 0 ? (savedKm / baseline.distanceKm) * 100 : 0;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Route comparison"
        title="Baseline vs optimized routes"
        subtitle="The same Mussoorie dustbin network planned two ways. Two simulated trucks stay synchronized across both routes."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={routing.source === 'osrm' ? 'blue' : 'amber'}>
              <RouteIcon className="h-2.5 w-2.5" />
              {routing.source === 'osrm'
                ? 'Road-network geometry'
                : routing.source === 'mixed'
                  ? 'Mixed geometry'
                  : 'Simulated geometry'}
            </Badge>
            <Badge
              tone={simulationStatus === 'running' ? 'green' : 'slate'}
            >
              <Truck className="h-2.5 w-2.5" />
              {simulationStatus === 'running'
                ? 'Fleet moving'
                : simulationStatus === 'paused'
                  ? 'Fleet paused'
                  : simulationStatus === 'complete'
                    ? 'Routes complete'
                    : 'Fleet staged'}
            </Badge>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">
                Same stops, different sequence
              </p>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-5 text-slate-500">
                Baseline uses plain nearest-neighbour ordering. Optimized adds
                capacity-aware trips, access penalties, priority bias and 2-opt
                improvements.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
            <Metric
              label="Distance saved"
              value={`${savedKm >= 0 ? '' : '+'}${formatKm(Math.abs(savedKm))}`}
              sub={`${formatPercent(Math.abs(savedPct), 1)} ${
                savedKm >= 0 ? 'shorter' : 'longer'
              }`}
              tone={savedKm >= 0 ? 'good' : 'warn'}
            />
            <Metric
              label="Operating saved"
              value={formatCurrency(savedCost)}
              sub="fuel + maintenance"
              icon={<Fuel className="h-3 w-3" />}
              tone={savedCost >= 0 ? 'good' : 'warn'}
            />
            <Metric
              label="Stops"
              value={String(optimized.stopOrder.length)}
              sub={`${optimized.depotReturns} depot unload${
                optimized.depotReturns === 1 ? '' : 's'
              }`}
              icon={<Warehouse className="h-3 w-3" />}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 px-4 py-2.5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Truck className="h-3 w-3 text-forest-700" />
            Truck animation is simulated, not live GPS. Click either truck to
            inspect its status and fit its route.
          </span>
          <Button
            variant={activePlanId === 'optimized' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setActivePlanId('optimized')}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {activePlanId === 'optimized'
              ? 'Optimized active live'
              : 'Use optimized live'}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <PlanMap
          plan={baseline}
          planId="baseline"
          cost={baselineCost.total}
          active={activePlanId === 'baseline'}
          onSelect={() => setActivePlanId('baseline')}
          description="Plain nearest-neighbour order with no capacity or access penalties."
        />
        <PlanMap
          plan={optimized}
          planId="optimized"
          cost={optimizedCost.total}
          active={activePlanId === 'optimized'}
          onSelect={() => setActivePlanId('optimized')}
          description="Capacity-aware greedy seed, priority bias and 2-opt improvements."
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InfoNote tone="slate" icon={<MapIcon className="h-3.5 w-3.5" />}>
          <span className="font-semibold text-slate-700">Left map:</span>{' '}
          {baseline.label.toLowerCase()} plan.{' '}
          {formatNumber(baseline.totalLoadKg)} kg across {baseline.trips} trip
          {baseline.trips === 1 ? '' : 's'}.{' '}
          {baseline.capacityFeasible
            ? 'Capacity feasible.'
            : 'Exceeds truck capacity without unload logic.'}
        </InfoNote>
        <InfoNote tone="green" icon={<RouteIcon className="h-3.5 w-3.5" />}>
          <span className="font-semibold text-forest-700">Right map:</span>{' '}
          {optimized.label.toLowerCase()} plan with{' '}
          {formatPercent(optimized.capacityUtilizationPct, 0)} peak capacity use.
          Route animation starts at {DEPOT.name} in {DEPOT.area}.
        </InfoNote>
      </div>
    </div>
  );
}

function PlanMap({
  plan,
  planId,
  cost,
  active,
  onSelect,
  description,
}: {
  plan: RoutePlan;
  planId: RoutePlanId;
  cost: number;
  active: boolean;
  onSelect: () => void;
  description: string;
}) {
  const optimized = planId === 'optimized';

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg',
                optimized
                  ? 'bg-forest-100 text-forest-700'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {optimized ? (
                <Sparkles className="h-3.5 w-3.5" />
              ) : (
                <MapIcon className="h-3.5 w-3.5" />
              )}
            </span>
            <p className="font-display text-sm font-semibold text-slate-900">
              {plan.label}
            </p>
            <Badge tone={plan.simulated ? 'amber' : 'blue'}>
              {plan.simulated ? 'Simulated' : 'Road'}
            </Badge>
          </div>
          <p className="mt-1 max-w-md text-[10px] leading-4 text-slate-400">
            {description}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-1 text-right">
          <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            <Clock3 className="h-2.5 w-2.5" />
            Drive time
          </p>
          <p className="font-mono text-[11px] font-semibold text-slate-700">
            {formatDuration(plan.durationMin)}
          </p>
        </div>
      </div>

      <div className="p-2.5">
        <UttarakhandMap heightClass="h-[480px]" showTruck planId={planId} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">{formatKm(plan.distanceKm)}</Badge>
          <Badge tone="slate">{formatCurrency(cost)}</Badge>
          <Badge tone={plan.capacityFeasible ? 'green' : 'red'}>
            {formatPercent(plan.capacityUtilizationPct, 0)} capacity
          </Badge>
        </div>
        <Button
          variant={active ? 'secondary' : 'outline'}
          size="sm"
          onClick={onSelect}
          disabled={active}
        >
          {active ? 'Active on live map' : 'Use this plan live'}
        </Button>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: React.ReactNode;
  tone?: 'good' | 'warn';
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 font-display text-sm font-semibold',
          tone === 'good'
            ? 'text-forest-700'
            : tone === 'warn'
              ? 'text-amber-700'
              : 'text-slate-800',
        )}
      >
        {value}
      </p>
      <p className="text-[9px] text-slate-400">{sub}</p>
    </div>
  );
}
