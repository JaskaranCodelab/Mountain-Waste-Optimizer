import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CheckCircle2,
  IndianRupee,
  PieChart as PieIcon,
  Route as RouteIcon,
  Scale,
  Truck,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import { WASTE_TYPE_META } from '../data/mockStops';
import { estimateOperatingCost } from '../lib/costCalculator';
import {
  formatCurrency,
  formatKm,
  formatNumber,
  shortName,
} from '../lib/geo';
import type { WasteType } from '../types';
import { Badge, Card, EmptyState } from './ui';

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  fontSize: 11,
  boxShadow: '0 10px 30px -12px rgba(15, 23, 42, 0.35)',
};

function chartLabel(name: string): string {
  const cleaned = shortName(name);
  return cleaned.length > 15 ? `${cleaned.slice(0, 14)}…` : cleaned;
}

export function AnalyticsCharts({ compact = false }: { compact?: boolean }) {
  const {
    stops,
    plans,
    optimization,
    settings,
    completedCount,
    pendingCount,
    wasteCollectedKg,
    totalWasteKg,
    routing,
  } = useApp();

  const hasStops = stops.length > 0;
  const completedPickups = stops.filter(
    (stop) => stop.status === 'Completed',
  ).length;
  const pendingPickups = stops.length - completedPickups;

  const stopData = stops.map((stop) => ({
    name: chartLabel(stop.name),
    collected: stop.status === 'Completed' ? stop.quantityKg : 0,
    pending:
      stop.status === 'Completed'
        ? 0
        : stop.quantityKg,
  }));

  const categoryMap = new Map<WasteType, number>();
  stops.forEach((stop) => {
    categoryMap.set(
      stop.wasteType,
      (categoryMap.get(stop.wasteType) ?? 0) + stop.quantityKg,
    );
  });
  const categoryData = (Object.keys(WASTE_TYPE_META) as WasteType[])
    .map((type) => ({
      name: WASTE_TYPE_META[type].shortLabel,
      value: categoryMap.get(type) ?? 0,
      color: WASTE_TYPE_META[type].color,
    }))
    .filter((entry) => entry.value > 0);

  const baselineDistance =
    plans.baseline?.distanceKm ?? optimization.baseline.estimatedDistanceKm;
  const optimizedDistance =
    plans.optimized?.distanceKm ?? optimization.optimized.estimatedDistanceKm;
  const distanceEstimated = !plans.baseline || !plans.optimized;

  const distanceData = [
    { name: 'Baseline', distance: Number(baselineDistance.toFixed(1)) },
    { name: 'Optimized', distance: Number(optimizedDistance.toFixed(1)) },
  ];

  const baselineCost = estimateOperatingCost(baselineDistance, settings);
  const optimizedCost = estimateOperatingCost(optimizedDistance, settings);
  const costData = [
    {
      name: 'Baseline',
      fuel: Number(baselineCost.fuelCost.toFixed(0)),
      maintenance: Number(baselineCost.maintenanceCost.toFixed(0)),
    },
    {
      name: 'Optimized',
      fuel: Number(optimizedCost.fuelCost.toFixed(0)),
      maintenance: Number(optimizedCost.maintenanceCost.toFixed(0)),
    },
  ];

  const pickupData = [
    { name: 'Completed', value: completedPickups, color: '#16a34a' },
    { name: 'Pending / active', value: pendingPickups, color: '#f59e0b' },
  ].filter((entry) => entry.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {!compact ? (
          <ChartCard
            icon={<BarChart3 className="h-4 w-4" />}
            title="Waste collected by stop"
            subtitle="Completed kg vs remaining scheduled pickups"
            badge={
              <Badge tone="slate">
                {formatNumber(wasteCollectedKg)} / {formatNumber(totalWasteKg)} kg
              </Badge>
            }
          >
            {hasStops ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stopData}
                    margin={{ top: 6, right: 8, left: -16, bottom: 26 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      interval={0}
                      angle={-24}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      unit=" kg"
                      width={52}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => `${formatNumber(Number(value))} kg`}
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                    />
                    <Bar
                      dataKey="collected"
                      name="Collected"
                      stackId="waste"
                      fill="#2f8058"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={26}
                    />
                    <Bar
                      dataKey="pending"
                      name="Pending / active"
                      stackId="waste"
                      fill="#cbd5e1"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={26}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartEmpty />
            )}
          </ChartCard>
        ) : null}

        <ChartCard
          icon={<PieIcon className="h-4 w-4" />}
          title="Waste by category"
          subtitle="Scheduled kilograms across the active demo profile"
        >
          {categoryData.length > 0 ? (
            <div className="relative h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                    strokeWidth={2}
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => `${formatNumber(Number(value))} kg`}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 top-[39%] text-center">
                <p className="font-display text-lg font-semibold text-slate-800">
                  {formatNumber(totalWasteKg)}
                </p>
                <p className="text-[9px] uppercase tracking-wide text-slate-400">
                  kg scheduled
                </p>
              </div>
            </div>
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>

        {!compact ? (
          <ChartCard
            icon={<RouteIcon className="h-4 w-4" />}
            title="Baseline vs optimized distance"
            subtitle="Road-network kilometres when road routing is available"
            badge={
              <Badge tone={distanceEstimated ? 'amber' : 'blue'}>
                {distanceEstimated ? 'Estimate' : 'Road'}
              </Badge>
            }
          >
            {hasStops ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distanceData}
                    margin={{ top: 10, right: 12, left: -8, bottom: 4 }}
                    barCategoryGap="32%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      unit=" km"
                      width={52}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => formatKm(Number(value))}
                    />
                    <Bar dataKey="distance" name="Distance" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {distanceData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={index === 0 ? '#94a3b8' : '#2f8058'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartEmpty />
            )}
          </ChartCard>
        ) : null}

        {!compact ? (
          <ChartCard
            icon={<IndianRupee className="h-4 w-4" />}
            title="Operating cost comparison"
            subtitle={`Fuel at ₹${settings.fuelPricePerL}/L • ${settings.fuelEfficiencyKmPerL} km/L • ₹${settings.maintenanceCostPerKm}/km upkeep`}
            badge={
              <Badge tone={routing.source === 'osrm' ? 'blue' : 'amber'}>
                {routing.source === 'osrm' ? 'Road distances' : 'Estimate'}
              </Badge>
            }
          >
            {hasStops ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={costData}
                    margin={{ top: 10, right: 12, left: -4, bottom: 4 }}
                    barCategoryGap="32%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                    />
                    <Bar
                      dataKey="fuel"
                      name="Fuel"
                      stackId="cost"
                      fill="#0ea5e9"
                      radius={[0, 0, 0, 0]}
                      maxBarSize={48}
                    />
                    <Bar
                      dataKey="maintenance"
                      name="Maintenance"
                      stackId="cost"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartEmpty />
            )}
          </ChartCard>
        ) : null}

        <ChartCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Completed vs pending pickups"
          subtitle={`${completedCount} completed • ${pendingCount} remaining`}
          badge={
            <Badge tone="forest">
              <Scale className="h-2.5 w-2.5" />
              {formatNumber(wasteCollectedKg)} kg collected
            </Badge>
          }
        >
          {pickupData.length > 0 ? (
            <div className="relative h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pickupData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={3}
                    strokeWidth={2}
                  >
                    {pickupData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => `${formatNumber(Number(value))} stops`}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 top-[39%] text-center">
                <p className="font-display text-lg font-semibold text-slate-800">
                  {completedPickups}/{stops.length}
                </p>
                <p className="text-[9px] uppercase tracking-wide text-slate-400">
                  stops complete
                </p>
              </div>
            </div>
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>

        {!compact ? (
          <ChartCard
            icon={<Truck className="h-4 w-4" />}
            title="Fleet & routing context"
            subtitle="Operational assumptions behind the comparison"
          >
            <div className="grid h-[250px] grid-cols-2 content-start gap-2.5">
              <ContextStat
                label="Truck capacity"
                value={`${formatNumber(settings.capacityKg)} kg`}
                hint="Adjustable 500–2,000 kg"
              />
              <ContextStat
                label="Baseline route"
                value={plans.baseline ? formatKm(plans.baseline.distanceKm) : 'Pending'}
                hint="Nearest-neighbour, no capacity"
              />
              <ContextStat
                label="Optimized route"
                value={
                  plans.optimized ? formatKm(plans.optimized.distanceKm) : 'Pending'
                }
                hint="Greedy + 2-opt"
              />
              <ContextStat
                label="Depot returns"
                value={String(plans.optimized?.depotReturns ?? 0)}
                hint="Capacity-triggered unloads"
              />
              <ContextStat
                label="Mountain penalties"
                value={`+${settings.steepPenaltyPct}% / +${settings.narrowPenaltyPct}%`}
                hint="Restricted / moderate access weighting"
              />
              <ContextStat
                label="Data source"
                value={routing.source === 'osrm' ? 'Road' : 'Simulated'}
                hint="Road geometry provenance"
              />
            </div>
          </ChartCard>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-400">
        <span>
          Charts update with simulation progress, stop edits, waste mode and
          optimizer changes.
        </span>
        <span className="font-mono text-slate-500">
          {completedCount}/{stops.length} stops • {formatNumber(wasteCollectedKg)} kg
        </span>
      </div>
    </div>
  );
}

function ChartCard({
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700">
            {icon}
          </span>
          <div>
            <p className="font-display text-[13px] font-semibold text-slate-800">
              {title}
            </p>
            <p className="text-[10px] leading-4 text-slate-400">{subtitle}</p>
          </div>
        </div>
        {badge}
      </div>
      {children}
    </Card>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-[250px] items-center justify-center">
      <EmptyState
        icon={<BarChart3 className="h-4 w-4" />}
        title="No chart data"
        description="Add pickup stops or wait for the route calculation to complete."
      />
    </div>
  );
}

function ContextStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 font-display text-sm font-semibold text-slate-800">
        {value}
      </p>
      <p className="text-[9px] leading-3 text-slate-400">{hint}</p>
    </div>
  );
}
