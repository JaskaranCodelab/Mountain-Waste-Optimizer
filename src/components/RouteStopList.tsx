import {
  ArrowLeftRight,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Mountain,
  Package,
  Warehouse,
} from 'lucide-react';
import { ACCESSIBILITY_META, DEPOT } from '../data/mockStops';
import { useApp } from '../store/AppStore';
import type { Stop } from '../types';
import { formatDuration, formatNumber } from '../lib/geo';
import { Badge, Card, EmptyState, cn } from './ui';

type StopRow = {
  kind: 'stop';
  stop: Stop;
  sequence: number;
  etaMin: number | null;
};

type DepotRow = { kind: 'depot' };

type ListRow = StopRow | DepotRow;

function statusClasses(status: Stop['status']): string {
  if (status === 'Completed') {
    return 'border-emerald-200 bg-emerald-600 text-white';
  }
  if (status === 'In Progress') {
    return 'border-amber-200 bg-amber-500 text-white';
  }
  return 'border-slate-200 bg-white text-slate-400';
}

function priorityDot(priority: Stop['priority']): string {
  if (priority === 'high') {
    return 'bg-red-500';
  }
  if (priority === 'medium') {
    return 'bg-amber-500';
  }
  return 'bg-teal-600';
}

export function RouteStopList({ className }: { className?: string }) {
  const { stops, activePlan, selectedStopId, selectStop, nextStopId, routing } =
    useApp();

  const rows: ListRow[] = [];
  if (activePlan) {
    let sequence = 0;
    for (let index = 0; index < activePlan.order.length; index += 1) {
      const nodeId = activePlan.order[index];
      if (nodeId === 'DEPOT') {
        if (index === 0 || index === activePlan.order.length - 1) {
          continue;
        }
        rows.push({ kind: 'depot' });
        continue;
      }
      const stop = stops.find((item) => item.id === nodeId);
      if (!stop) {
        continue;
      }
      sequence += 1;
      rows.push({
        kind: 'stop',
        stop,
        sequence,
        etaMin: activePlan.arrivalMin[stop.id] ?? null,
      });
    }
  } else {
    stops.forEach((stop, index) => {
      rows.push({ kind: 'stop', stop, sequence: index + 1, etaMin: null });
    });
  }

  const stopRows = rows.filter(
    (row): row is StopRow => row.kind === 'stop',
  );

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Ordered stop sequence
          </h3>
          <p className="text-[10px] text-slate-400">
            {activePlan
              ? activePlan.label
              : routing.loading
                ? 'Waiting for route geometry'
                : 'Fallback list • route unavailable'}
          </p>
        </div>
        <Badge tone={activePlan?.simulated ? 'amber' : 'blue'}>
          {activePlan?.simulated ? 'Simulated' : 'Road route'}
        </Badge>
      </div>

      {stopRows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Package className="h-4 w-4" />}
            title="No pickup stops"
            description="Add simulated stops in Pickup Stops to build a route."
          />
        </div>
      ) : (
        <div className="max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
          {rows.map((row, index) => {
            if (row.kind === 'depot') {
              return (
                <div
                  key={`depot-${index}`}
                  className="flex items-center gap-3 bg-slate-50/70 px-4 py-2.5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-400">
                    <Warehouse className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-slate-600">
                      Depot unload / capacity reset
                    </p>
                    <p className="text-[9px] text-slate-400">
                      Planned return to {DEPOT.name}
                    </p>
                  </div>
                </div>
              );
            }
            const { stop, sequence, etaMin } = row;
            const selected = selectedStopId === stop.id;
            const isNext = nextStopId === stop.id;
            return (
              <button
                type="button"
                key={stop.id}
                onClick={() => selectStop(stop.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition',
                  selected ? 'bg-forest-50' : 'hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                    statusClasses(stop.status),
                  )}
                >
                  {stop.status === 'Completed' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : stop.status === 'In Progress' ? (
                    <Clock3 className="h-3.5 w-3.5" />
                  ) : (
                    sequence
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-semibold text-slate-800">
                      {stop.name}
                    </span>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        priorityDot(stop.priority),
                      )}
                      title={`${stop.priority} priority`}
                    />
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-slate-400">
                    <span className="truncate">{stop.area}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-500">
                      {formatNumber(stop.quantityKg)} kg
                    </span>
                    <span>•</span>
                    <span className="capitalize">{stop.wasteType}</span>
                    {stop.accessibility !== 'easy' ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded px-1 py-px font-medium',
                          stop.accessibility === 'restricted'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        <Mountain className="h-2.5 w-2.5" />
                        {ACCESSIBILITY_META[stop.accessibility].label}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[10px] font-semibold text-slate-600">
                    {etaMin === null ? '—' : `T+${formatDuration(etaMin)}`}
                  </span>
                  {isNext ? (
                    <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-forest-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-forest-700">
                      Next
                    </span>
                  ) : (
                    <ChevronRight className="ml-auto mt-0.5 h-3 w-3 text-slate-300" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[9px] text-slate-400">
        <span>
          <Circle className="mr-1 inline h-1.5 w-1.5 fill-current" />
          Click a row to highlight the stop on the map
        </span>
        <span className="flex items-center gap-1">
          <ArrowLeftRight className="h-2.5 w-2.5" />
          {activePlan?.stopOrder.length ?? stops.length} stops
        </span>
      </div>
    </Card>
  );
}
