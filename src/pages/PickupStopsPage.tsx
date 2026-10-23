import { Leaf, MapPin, Mountain, PackagePlus, Scale } from 'lucide-react';
import { useApp } from '../store/AppStore';
import {
  ACCESSIBILITY_META,
  PRIORITY_META,
  WASTE_MODE_META,
  WASTE_TYPE_META,
} from '../data/mockStops';
import { formatNumber } from '../lib/geo';
import { PickupStopsTable } from '../components/PickupStopsTable';
import { UttarakhandMap } from '../components/UttarakhandMap';
import {
  Badge,
  Card,
  SectionHeader,
  type BadgeTone,
} from '../components/ui';

function priorityTone(priority: 'high' | 'medium' | 'low'): BadgeTone {
  return priority === 'high' ? 'red' : priority === 'medium' ? 'amber' : 'teal';
}

export function PickupStopsPage() {
  const { stops, wasteMode, selectedStopId } = useApp();
  const meta = WASTE_MODE_META[wasteMode];
  const selected = stops.find((stop) => stop.id === selectedStopId) ?? null;
  const totalKg = stops.reduce((sum, stop) => sum + stop.quantityKg, 0);
  const highPriority = stops.filter((stop) => stop.priority === 'high').length;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Pickup stops"
        title="Manage the simulated collection network"
        subtitle="Add, edit, filter and remove demo pickup records. Every change re-optimizes the route and recalculates costs immediately."
        action={
          <Badge tone="amber">
            <PackagePlus className="h-2.5 w-2.5" />
            Simulated records
          </Badge>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${meta.accent}16`, color: meta.accent }}
            >
              <Leaf className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-semibold text-slate-900">
                  {meta.label} profile
                </p>
                <Badge tone="forest">{stops.length} stops</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
                {meta.description}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[300px]">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                Scheduled
              </p>
              <p className="font-display text-sm font-semibold text-slate-800">
                {formatNumber(totalKg)} kg
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                High priority
              </p>
              <p className="font-display text-sm font-semibold text-slate-800">
                {highPriority}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                Wastes
              </p>
              <p className="font-display text-sm font-semibold text-slate-800">
                {new Set(stops.map((stop) => stop.wasteType)).size}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <PickupStopsTable />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-slate-900">
              <MapPin className="h-3.5 w-3.5 text-forest-600" />
              {selected ? selected.name : 'Stop location preview'}
            </p>
            <p className="text-[10px] text-slate-400">
              {selected
                ? `${selected.area} • ${selected.note}`
                : 'Select any stop in the table to preview its location on the map.'}
            </p>
          </div>
          {selected ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={priorityTone(selected.priority)}>
                {PRIORITY_META[selected.priority].label} priority
              </Badge>
              <Badge
                tone={
                  selected.accessibility === 'easy'
                    ? 'slate'
                    : selected.accessibility === 'restricted'
                      ? 'red'
                      : 'amber'
                }
              >
                <Mountain className="h-2.5 w-2.5" />
                {ACCESSIBILITY_META[selected.accessibility].label}
              </Badge>
              <Badge tone="forest">
                {WASTE_TYPE_META[selected.wasteType].shortLabel}
              </Badge>
              <Badge tone="slate">
                <Scale className="h-2.5 w-2.5" />
                {formatNumber(selected.quantityKg)} kg
              </Badge>
            </div>
          ) : null}
        </div>
        <div className="p-2.5">
          <UttarakhandMap heightClass="h-[420px]" />
        </div>
      </Card>
    </div>
  );
}
