import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Database,
  FlaskConical,
  Fuel,
  Gauge,
  MapPin,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Truck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import {
  CAPACITY_MAX_KG,
  CAPACITY_MIN_KG,
  DEFAULT_SETTINGS,
} from '../lib/costCalculator';
import { formatDuration, formatNumber } from '../lib/geo';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Badge,
  Button,
  Card,
  InfoNote,
  SectionHeader,
  selectClass,
} from './ui';

function formatSpan(seconds: number): string {
  if (seconds < 60) {
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} sec`;
  }
  return formatDuration(seconds / 60);
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className="font-mono text-[11px] font-semibold text-forest-700">
          {value}
          <span className="ml-0.5 text-[9px] font-medium text-slate-400">
            {unit}
          </span>
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 w-full"
        aria-label={label}
      />
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function SettingsPanel() {
  const {
    settings,
    updateSettings,
    setCapacityKg,
    routing,
    retryRouting,
    resetDemoData,
    stops,
    wasteMode,
    requestGeolocation,
    geoStatus,
    geoMessage,
    userLocation,
  } = useApp();
  const [resetOpen, setResetOpen] = useState(false);

  const tickSeconds = (100 / settings.simulationStepPct) *
    (settings.simulationIntervalMs / 1000);

  const sourceLabel =
    routing.source === 'osrm'
      ? 'OpenStreetMap road network'
      : routing.source === 'mixed'
        ? 'Partially simulated'
        : routing.source === 'simulated'
          ? 'Simulated fallback'
          : 'Pending';

  const updatedLabel = routing.updatedAt
    ? new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(routing.updatedAt))
    : 'Not yet';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-700 text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">
                Demo configuration
              </p>
              <p className="text-[10px] text-slate-400">
                Assumptions persist in LocalStorage for this browser.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="forest">
            <Truck className="h-2.5 w-2.5" />
            Capacity {formatNumber(settings.capacityKg)} kg
          </Badge>
          <Badge tone={routing.source === 'osrm' ? 'blue' : 'amber'}>
            {sourceLabel}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateSettings({
                capacityKg: DEFAULT_SETTINGS.capacityKg,
                fuelEfficiencyKmPerL: DEFAULT_SETTINGS.fuelEfficiencyKmPerL,
                fuelPricePerL: DEFAULT_SETTINGS.fuelPricePerL,
                maintenanceCostPerKm: DEFAULT_SETTINGS.maintenanceCostPerKm,
                steepPenaltyPct: DEFAULT_SETTINGS.steepPenaltyPct,
                narrowPenaltyPct: DEFAULT_SETTINGS.narrowPenaltyPct,
                priorityWeightPct: DEFAULT_SETTINGS.priorityWeightPct,
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset assumptions
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Routing"
            title="Road network service"
            subtitle="OpenStreetMap road routing is used where available; the app never presents invented roads as real."
            action={
              <Badge tone={routing.source === 'osrm' ? 'green' : 'amber'}>
                {routing.source === 'osrm' ? (
                  <Wifi className="h-2.5 w-2.5" />
                ) : (
                  <WifiOff className="h-2.5 w-2.5" />
                )}
                {routing.source === 'osrm' ? 'Connected' : 'Fallback'}
              </Badge>
            }
          />
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Routing provider
              </span>
              <select
                className={selectClass}
                value={settings.routingProvider}
                onChange={(event) =>
                  updateSettings({
                    routingProvider: event.target.value as
                      | 'osrm'
                      | 'simulated',
                  })
                }
              >
                <option value="osrm">
                  OpenStreetMap road routing (real road geometry)
                </option>
                <option value="simulated">
                  Simulated only (no external requests)
                </option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Current source
                </p>
                <p className="text-[11px] font-semibold text-slate-700">
                  {sourceLabel}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Last checked
                </p>
                <p className="text-[11px] font-semibold text-slate-700">
                  {updatedLabel}
                </p>
              </div>
            </div>

            {routing.error ? (
              <InfoNote
                tone="amber"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              >
                {routing.error}
              </InfoNote>
            ) : (
              <InfoNote
                tone="green"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                Route geometry reflects OpenStreetMap road distances. If the
                public routing services are unavailable or rate-limited, the
                app labels the fallback as simulated.
              </InfoNote>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={retryRouting}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry routing
              </Button>
              <span className="text-[10px] text-slate-400">
                OSM tiles © OpenStreetMap contributors • public road-routing services
              </span>
            </div>

            <InfoNote tone="slate" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
              The routing layer is isolated in <code>src/lib/routingService.ts</code>{' '}
              so another provider can be added later. External services may be
              rate-limited; the simulation never depends on them.
            </InfoNote>
          </div>
        </Card>

        <Card className="p-4">
          <SectionHeader
            eyebrow="Simulation"
            title="Truck movement controls"
            subtitle="This is a browser animation along route geometry — not live GPS telemetry."
          />
          <div className="mt-3 space-y-4">
            <SliderField
              label="Simulation interval"
              value={settings.simulationIntervalMs}
              min={100}
              max={2000}
              step={50}
              unit="ms"
              hint="How often the truck marker advances while the simulation runs."
              onChange={(value) =>
                updateSettings({ simulationIntervalMs: value })
              }
            />
            <SliderField
              label="Progress per tick"
              value={settings.simulationStepPct}
              min={0.02}
              max={3}
              step={0.01}
              unit="%"
              hint={`At current settings a full route takes about ${formatSpan(
                tickSeconds,
              )} to animate.`}
              onChange={(value) =>
                updateSettings({ simulationStepPct: value })
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  <Timer className="h-3 w-3 text-forest-600" />
                  Full-route animation
                </p>
                <p className="mt-0.5 font-display text-sm font-semibold text-slate-800">
                  {formatSpan(tickSeconds)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  <Gauge className="h-3 w-3 text-forest-600" />
                  Tick frequency
                </p>
                <p className="mt-0.5 font-display text-sm font-semibold text-slate-800">
                  {(1000 / settings.simulationIntervalMs).toFixed(1)}/s
                </p>
              </div>
            </div>
            <InfoNote
              tone="blue"
              icon={<RouteIcon className="h-3.5 w-3.5" />}
            >
              Use Start, Pause, Resume, Next Stop and Reset in the truck panel on
              the Overview, Live Map or Route Planner pages.
            </InfoNote>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionHeader
            eyebrow="Cost model"
            title="Transparent assumptions"
            subtitle="Used for route cost estimates and fuel savings. No live fuel-price feed is connected."
            action={
              <Badge tone="forest">
                <Fuel className="h-2.5 w-2.5" />
                ₹{' '}
                {(
                  settings.fuelPricePerL / settings.fuelEfficiencyKmPerL +
                  settings.maintenanceCostPerKm
                ).toFixed(2)}
                /km
              </Badge>
            }
          />
          <div className="mt-3 space-y-4">
            <SliderField
              label="Truck capacity"
              value={settings.capacityKg}
              min={CAPACITY_MIN_KG}
              max={CAPACITY_MAX_KG}
              step={50}
              unit="kg"
              hint="Pickups are grouped into trips that never exceed this load."
              onChange={setCapacityKg}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SliderField
                label="Fuel efficiency"
                value={settings.fuelEfficiencyKmPerL}
                min={2}
                max={12}
                step={0.5}
                unit="km/L"
                onChange={(value) =>
                  updateSettings({ fuelEfficiencyKmPerL: value })
                }
              />
              <SliderField
                label="Diesel price"
                value={settings.fuelPricePerL}
                min={60}
                max={140}
                step={0.5}
                unit="₹/L"
                onChange={(value) =>
                  updateSettings({ fuelPricePerL: value })
                }
              />
              <SliderField
                label="Maintenance"
                value={settings.maintenanceCostPerKm}
                min={0}
                max={30}
                step={1}
                unit="₹/km"
                onChange={(value) =>
                  updateSettings({ maintenanceCostPerKm: value })
                }
              />
              <SliderField
                label="Restricted access penalty"
                value={settings.steepPenaltyPct}
                min={0}
                max={60}
                step={1}
                unit="%"
                onChange={(value) =>
                  updateSettings({ steepPenaltyPct: value })
                }
              />
              <SliderField
                label="Moderate access penalty"
                value={settings.narrowPenaltyPct}
                min={0}
                max={60}
                step={1}
                unit="%"
                onChange={(value) =>
                  updateSettings({ narrowPenaltyPct: value })
                }
              />
              <SliderField
                label="Priority weighting"
                value={settings.priorityWeightPct}
                min={0}
                max={40}
                step={1}
                unit="%"
                onChange={(value) =>
                  updateSettings({ priorityWeightPct: value })
                }
              />
            </div>
            <InfoNote
              tone="slate"
              icon={<FlaskConical className="h-3.5 w-3.5" />}
            >
              These values are configurable assumptions, not live operating
              data. Fuel cost = distance ÷ efficiency × price; maintenance is a
              flat per-kilometre model.
            </InfoNote>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader
              eyebrow="Device"
              title="Optional browser location"
              subtitle="Requested only when you click the button. It is shown as a blue reference dot, never used as truck GPS."
              action={
                <Badge
                  tone={
                    geoStatus === 'granted'
                      ? 'green'
                      : geoStatus === 'denied' || geoStatus === 'error'
                        ? 'red'
                        : 'slate'
                  }
                >
                  <MapPin className="h-2.5 w-2.5" />
                  {geoStatus === 'idle'
                    ? 'Not requested'
                    : geoStatus === 'requesting'
                      ? 'Requesting…'
                      : geoStatus === 'granted'
                        ? 'Shared'
                        : geoStatus === 'denied'
                          ? 'Denied'
                          : geoStatus === 'unsupported'
                            ? 'Unsupported'
                            : 'Error'}
                </Badge>
              }
            />
            <div className="mt-3 space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={requestGeolocation}
                loading={geoStatus === 'requesting'}
              >
                <Crosshair className="h-3.5 w-3.5" />
                {userLocation
                  ? 'Refresh device location'
                  : 'Use my location'}
              </Button>
              {userLocation ? (
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[10px] text-sky-800">
                  <p className="font-semibold">Device position available</p>
                  <p className="font-mono">
                    {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                  </p>
                </div>
              ) : null}
              <p className="text-[10px] leading-4 text-slate-400">
                {geoMessage ??
                  'No location request has been made. The map works fully without it.'}
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader
              eyebrow="Data"
              title="Demo data & persistence"
              subtitle="Stop edits, mode, capacity and assumptions are stored locally in your browser."
              action={
                <Badge tone="slate">
                  <Database className="h-2.5 w-2.5" />
                  LocalStorage
                </Badge>
              }
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Active profile
                </p>
                <p className="text-[11px] font-semibold capitalize text-slate-700">
                  {wasteMode}
                </p>
                <p className="text-[9px] text-slate-400">
                  {formatNumber(stops.length)} stop
                  {stops.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Persistence
                </p>
                <p className="text-[11px] font-semibold text-emerald-700">
                  Enabled
                </p>
                <p className="text-[9px] text-slate-400">
                  Browser-only storage
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setResetOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset demo data
              </Button>
              <p className="text-[10px] leading-4 text-slate-400">
                Resets all three mode datasets to the original 10 seeded stops,
                restores default assumptions and clears the saved demo state.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-900">
              Data provenance & honest limitations
            </p>
            <p className="text-[10px] leading-5 text-amber-800">
              All pickup records, quantities, priorities and statuses are
              simulated demo data. Truck movement, ETAs and telemetry are
              browser-rendered visualizations, not live GPS. No live traffic,
              fuel-price or municipal collection feeds are connected. The route
              optimizer is a transparent heuristic (nearest-neighbour,
              capacity-aware greedy, 2-opt and priority weighting) — not a
              trained machine-learning model. OpenStreetMap road-routing services are used
              for real road geometry where available.
            </p>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={resetOpen}
        title="Reset all demo data?"
        description="All three waste-mode datasets, stop edits, simulation settings and cost assumptions will return to their original defaults."
        confirmLabel="Reset demo data"
        onConfirm={resetDemoData}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}
