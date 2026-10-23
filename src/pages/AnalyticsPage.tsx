import { BarChart3, Database, IndianRupee } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { StatsCards } from '../components/StatsCards';
import { Badge, SectionHeader } from '../components/ui';

export function AnalyticsPage() {
  const { stops, wasteMode, settings, activePlan } = useApp();

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Analytics"
        title="Collection, capacity and cost insights"
        subtitle="Charts are generated from the simulated stop dataset and the current route plan. Costs use configurable assumptions, not live fuel prices."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="slate">
              <Database className="h-2.5 w-2.5" />
              {stops.length} demo stops
            </Badge>
            <Badge tone="forest">
              <BarChart3 className="h-2.5 w-2.5" />
              {wasteMode} profile
            </Badge>
            <Badge tone="amber">
              <IndianRupee className="h-2.5 w-2.5" />
              Assumed ₹{settings.fuelPricePerL}/L diesel
            </Badge>
          </div>
        }
      />

      <StatsCards />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] text-slate-500 shadow-card">
        <span>
          Route basis:{' '}
          <span className="font-semibold text-slate-700">
            {activePlan
              ? activePlan.simulated
                ? 'Simulated geometry fallback'
                : 'Road-network geometry'
              : 'Route unavailable'}
          </span>{' '}
          • Optimizer: capacity-aware nearest neighbour + 2-opt heuristic
        </span>
        <span>
          Waste quantities and stop statuses are simulated demo values.
        </span>
      </div>

      <AnalyticsCharts />
    </div>
  );
}
