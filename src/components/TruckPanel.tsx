import {
  AlertTriangle,
  ArrowRight,
  Gauge,
  MapPin,
  Navigation,
  PackageCheck,
  Route as RouteIcon,
  Scale,
  Timer,
  Truck,
  Warehouse,
} from 'lucide-react';
import { DEPOT } from '../data/mockStops';
import { useApp } from '../store/AppStore';
import {
  formatCurrency,
  formatDuration,
  formatKm,
  formatNumber,
  formatPercent,
} from '../lib/geo';
import { RouteControls } from './RouteControls';
import { Badge, Card, InfoNote, ProgressBar, cn } from './ui';

export function TruckPanel() {
  const {
    activePlan,
    activePlanId,
    fleet,
    selectedTruckId,
    simulationStatus,
    progress,
    travelledKm,
    remainingKm,
    wasteCollectedKg,
    completedCount,
    stops,
    nextStop,
    nextStopEtaMin,
    nextStopDistanceKm,
    currentLocationLabel,
    activeCost,
    travelledCost,
    onboardKg,
    unloadedKg,
    settings,
    routing,
    selectStop,
  } = useApp();

  const statusTone =
    simulationStatus === 'running'
      ? 'green'
      : simulationStatus === 'paused'
        ? 'amber'
        : simulationStatus === 'complete'
          ? 'blue'
          : 'slate';

  const statusLabel =
    simulationStatus === 'running'
      ? 'Simulated en route'
      : simulationStatus === 'paused'
        ? 'Paused'
        : simulationStatus === 'complete'
          ? 'Route complete'
          : 'At depot • ready';

  const focusTruck =
    (selectedTruckId
      ? fleet.find((truck) => truck.id === selectedTruckId)
      : null) ??
    fleet.find((truck) => truck.planId === activePlanId) ??
    fleet[0];

  const truckCapacityKg = focusTruck?.capacityKg ?? settings.capacityKg;
  const loadPct =
    truckCapacityKg > 0 ? (onboardKg / truckCapacityKg) * 100 : 0;
  const truckCapacityExceeded = Boolean(
    activePlan && activePlan.maxTripLoadKg > truckCapacityKg + 1e-6,
  );
  const ticks = activePlan
    ? activePlan.stopOrder.map((id) =>
        activePlan.distanceKm > 0
          ? ((activePlan.arrivalKm[id] ?? 0) / activePlan.distanceKm) * 100
          : 0,
      )
    : [];

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-br from-forest-900 via-forest-800 to-forest-700 px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-forest-50 ring-1 ring-white/20',
                simulationStatus === 'running' && 'animate-pulse',
              )}
            >
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest-300">
                {selectedTruckId ? 'Selected fleet truck' : 'Live fleet tracking'}
              </p>
              <p className="font-display text-base font-semibold leading-tight">
                {focusTruck?.name ?? 'Collection fleet'}
              </p>
              <p className="text-[10px] text-forest-300">
                {focusTruck?.id ?? '2 trucks'} •{' '}
                {focusTruck?.type ?? 'Collection fleet'}
              </p>
              <p className="text-[10px] text-forest-300">
                {activePlan?.label ?? 'Route'} • {DEPOT.name}
              </p>
            </div>
          </div>
          <Badge
            tone={statusTone}
            className="border-white/20 bg-white/10 text-white"
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                simulationStatus === 'running'
                  ? 'bg-emerald-300'
                  : simulationStatus === 'paused'
                    ? 'bg-amber-300'
                    : simulationStatus === 'complete'
                      ? 'bg-sky-300'
                      : 'bg-slate-300',
              )}
            />
            {statusLabel}
          </Badge>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-black/10 px-3 py-2 text-[11px] text-forest-100">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-300" />
          <span className="line-clamp-2">{currentLocationLabel}</span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {focusTruck ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Truck className="h-3.5 w-3.5 text-forest-600" />
                Vehicle profile
              </p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-600 ring-1 ring-slate-200">
                {formatNumber(focusTruck.capacityKg)} kg
              </span>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-700">
              {focusTruck.type}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-slate-500">
              <span>{focusTruck.id}</span>
              <span>•</span>
              <span>{focusTruck.fuel}</span>
              <span>•</span>
              <span>{activePlan?.label ?? 'Route'} plan</span>
            </div>
            <p className="mt-1.5 border-t border-slate-200/70 pt-1.5 text-[10px] leading-4 text-slate-500">
              <span className="font-semibold text-slate-600">Best for:</span>{' '}
              {focusTruck.bestFor}
            </p>
          </div>
        ) : null}

        {!activePlan ? (
          <div className="space-y-2">
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-20 rounded-xl" />
            <p className="text-center text-[11px] text-slate-400">
              {routing.loading
                ? 'Loading road geometry and route statistics…'
                : 'No route is available. Add at least one pickup stop.'}
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600">
                  Route progress
                </span>
                <span className="font-mono font-semibold text-forest-700">
                  {formatPercent(progress * 100, 1)}
                </span>
              </div>
              <div className="relative mt-2">
                <ProgressBar value={progress * 100} className="h-2.5" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-2.5">
                  {ticks.map((tick, index) => (
                    <span
                      key={`${activePlan.stopOrder[index]}-${tick}`}
                      className="absolute top-0 h-2.5 w-px bg-white/70"
                      style={{ left: `${Math.min(100, tick)}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] text-slate-400">
                <span>Depot</span>
                <span>
                  {completedCount}/{stops.length} stops completed
                </span>
                <span>Return</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric
                icon={<RouteIcon className="h-3.5 w-3.5" />}
                label="Total route"
                value={formatKm(activePlan.distanceKm)}
              />
              <Metric
                icon={<Navigation className="h-3.5 w-3.5" />}
                label="Travelled"
                value={formatKm(travelledKm)}
              />
              <Metric
                icon={<Gauge className="h-3.5 w-3.5" />}
                label="Remaining"
                value={formatKm(remainingKm)}
              />
              <Metric
                icon={<PackageCheck className="h-3.5 w-3.5" />}
                label="Waste collected"
                value={`${formatNumber(wasteCollectedKg)} kg`}
              />
              <Metric
                icon={<Scale className="h-3.5 w-3.5" />}
                label="Cost incurred"
                value={formatCurrency(travelledCost.total)}
                sub={`of ${formatCurrency(activeCost.total)}`}
              />
              <Metric
                icon={<Warehouse className="h-3.5 w-3.5" />}
                label="Unloaded"
                value={`${formatNumber(unloadedKg)} kg`}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-forest-600" />
                  Onboard load
                </span>
                <span className="font-mono">
                  {formatNumber(onboardKg)} / {formatNumber(truckCapacityKg)} kg
                </span>
              </div>
              <ProgressBar
                value={loadPct}
                tone={loadPct > 100 ? 'red' : loadPct > 85 ? 'amber' : 'forest'}
                className="mt-2 h-2"
              />
              <div className="mt-1 flex items-center justify-between text-[9px] text-slate-400">
                <span>{formatPercent(loadPct, 0)} of capacity</span>
                <span>
                  {activePlan.depotReturns > 0
                    ? `${activePlan.depotReturns} depot unload${
                        activePlan.depotReturns > 1 ? 's' : ''
                      } planned`
                    : 'Single trip planned'}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-forest-200 bg-forest-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-forest-700">
                    <ArrowRight className="h-3 w-3" />
                    Next pickup
                  </p>
                  {nextStop ? (
                    <>
                      <p className="mt-1 truncate text-sm font-semibold text-forest-950">
                        {nextStop.name}
                      </p>
                      <p className="truncate text-[10px] text-forest-600">
                        {nextStop.area} • {formatNumber(nextStop.quantityKg)} kg{' '}
                        {nextStop.wasteType}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-forest-950">
                      {simulationStatus === 'complete'
                        ? 'All pickups complete'
                        : 'En route to the depot'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => nextStop && selectStop(nextStop.id)}
                  disabled={!nextStop}
                  className="rounded-lg border border-forest-200 bg-white px-2 py-1 text-[9px] font-semibold text-forest-700 transition hover:bg-forest-50 disabled:opacity-40"
                >
                  Inspect
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 text-forest-700">
                  <Timer className="h-3 w-3" />
                  ETA{' '}
                  <span className="font-semibold">
                    {nextStopEtaMin === null
                      ? '—'
                      : formatDuration(nextStopEtaMin)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-forest-700">
                  <Navigation className="h-3 w-3" />
                  Distance{' '}
                  <span className="font-semibold">
                    {nextStopDistanceKm === null
                      ? '—'
                      : formatKm(nextStopDistanceKm)}
                  </span>
                </div>
              </div>
            </div>

            {truckCapacityExceeded ? (
              <InfoNote
                tone="red"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              >
                This plan's maximum trip load is{' '}
                {formatNumber(activePlan.maxTripLoadKg)} kg, above{' '}
                {focusTruck?.name ?? 'this truck'}'s{' '}
                {formatNumber(truckCapacityKg)} kg capacity. Use the large truck
                or add depot returns.
              </InfoNote>
            ) : null}

            <div className="text-[10px] leading-4 text-slate-400">
              <span className="font-semibold text-slate-500">
                {activePlan.simulated ? 'Simulated estimate' : 'Road route'}
              </span>{' '}
              • truck movement is a visualization, not live GPS or fleet
              telemetry. Waste collected updates as simulated stops are reached.
            </div>
          </>
        )}

        <div className="border-t border-slate-100 pt-3">
          <RouteControls compact />
        </div>
      </div>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-2.5">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="text-forest-600">{icon}</span>
        {label}
      </p>
      <p className="mt-1 truncate font-display text-[13px] font-semibold text-slate-800">
        {value}
      </p>
      {sub ? <p className="text-[9px] text-slate-400">{sub}</p> : null}
    </div>
  );
}
