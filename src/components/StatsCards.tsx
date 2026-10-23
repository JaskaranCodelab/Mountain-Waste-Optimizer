import {
  CheckCircle2,
  Clock3,
  IndianRupee,
  PackageSearch,
  Route,
  Scale,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import { formatCurrency, formatKm, formatNumber } from '../lib/geo';
import { Card, cn } from './ui';

export function StatsCards() {
  const {
    stops,
    completedCount,
    pendingCount,
    inProgressCount,
    wasteCollectedKg,
    totalWasteKg,
    activePlan,
    activeCost,
    routing,
  } = useApp();

  const cards = [
    {
      label: 'Total pickup stops',
      value: formatNumber(stops.length),
      sub: 'Simulated collection points',
      icon: PackageSearch,
      iconClass: 'bg-forest-50 text-forest-700',
      accent: 'bg-forest-500',
    },
    {
      label: 'Completed',
      value: formatNumber(completedCount),
      sub: `of ${stops.length} stops collected`,
      icon: CheckCircle2,
      iconClass: 'bg-emerald-50 text-emerald-600',
      accent: 'bg-emerald-500',
    },
    {
      label: 'Pending',
      value: formatNumber(pendingCount),
      sub:
        inProgressCount > 0
          ? `${inProgressCount} in progress`
          : 'No active pickup',
      icon: Clock3,
      iconClass: 'bg-amber-50 text-amber-600',
      accent: 'bg-amber-500',
    },
    {
      label: 'Waste collected',
      value: `${formatNumber(wasteCollectedKg)} kg`,
      sub: `of ${formatNumber(totalWasteKg)} kg scheduled`,
      icon: Scale,
      iconClass: 'bg-sky-50 text-sky-600',
      accent: 'bg-sky-500',
    },
    {
      label: 'Route distance',
      value: activePlan ? formatKm(activePlan.distanceKm) : '—',
      sub: activePlan
        ? activePlan.simulated
          ? 'Simulated estimate'
          : 'Road-network distance'
        : routing.loading
          ? 'Calculating route…'
          : 'No route',
      icon: Route,
      iconClass: 'bg-violet-50 text-violet-600',
      accent: 'bg-violet-500',
    },
    {
      label: 'Estimated route cost',
      value: activePlan ? formatCurrency(activeCost.total) : '—',
      sub: 'Fuel + maintenance model',
      icon: IndianRupee,
      iconClass: 'bg-teal-50 text-teal-600',
      accent: 'bg-teal-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-float"
          >
            <span
              className={cn(
                'absolute inset-x-0 top-0 h-0.5 opacity-80',
                card.accent,
              )}
            />
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase leading-4 tracking-[0.1em] text-slate-400">
                {card.label}
              </p>
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  card.iconClass,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 truncate font-display text-xl font-semibold tracking-tight text-slate-900">
              {card.value}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">
              {card.sub}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
