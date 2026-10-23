import {
  ArrowUpRight,
  Compass,
  Map as MapIcon,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import { WASTE_MODE_META } from '../data/mockStops';
import { formatNumber } from '../lib/geo';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { RouteComparison } from '../components/RouteComparison';
import { RouteStopList } from '../components/RouteStopList';
import { StatsCards } from '../components/StatsCards';
import { TruckPanel } from '../components/TruckPanel';
import { UttarakhandMap } from '../components/UttarakhandMap';
import { Badge, Button, Card } from '../components/ui';

export function OverviewPage() {
  const {
    wasteMode,
    settings,
    routing,
    activePlan,
    stops,
    setView,
    optimizeRoute,
    fleet,
    driverTracking,
  } = useApp();

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-forest-800 bg-gradient-to-br from-forest-950 via-forest-900 to-forest-700 p-5 text-white shadow-float">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-forest-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-300">
              <Compass className="h-3 w-3" />
              Uttarakhand mountain logistics
            </p>
            <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Smarter collection routes for the hills.
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-forest-200">
              Optimizes routes using terrain, volume and accessibility.{' '}
              {formatNumber(stops.length)} simulated pickup stops across
              Mussoorie's Mall Road, Landour and surrounding hills, a two-truck
              demo fleet, and a transparent capacity-aware optimizer. Road
              geometry comes from OpenStreetMap routing where available.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="forest" className="border-white/15 bg-white/10 text-forest-100">
                {WASTE_MODE_META[wasteMode].label}
              </Badge>
              <Badge
                tone={routing.source === 'osrm' ? 'green' : 'amber'}
                className="border-white/15 bg-white/10 text-white"
              >
                {routing.source === 'osrm' ? (
                  <Wifi className="h-2.5 w-2.5" />
                ) : (
                  <WifiOff className="h-2.5 w-2.5" />
                )}
                {routing.source === 'osrm'
                  ? 'Road-network routing'
                  : 'Simulated fallback'}
              </Badge>
              <Badge tone="slate" className="border-white/15 bg-white/10 text-forest-100">
                Truck capacity {formatNumber(settings.capacityKg)} kg
              </Badge>
              <Badge tone="slate" className="border-white/15 bg-white/10 text-forest-100">
                {activePlan ? activePlan.label : 'Route loading'}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setView('map')}
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <MapIcon className="h-3.5 w-3.5" />
              Open live map
              <ArrowUpRight className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              onClick={optimizeRoute}
              className="bg-white text-forest-900 hover:bg-forest-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Optimize route
            </Button>
          </div>
        </div>
      </div>

      <StatsCards />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(330px,1fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Mussoorie collection map
                </h3>
                <p className="text-[10px] text-slate-400">
                  {fleet.length + (driverTracking ? 1 : 0)} active trucks, Mussoorie pickups and both route
                  scenarios • drag and zoom to explore
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone={activePlan?.simulated ? 'amber' : 'blue'}>
                  {activePlan?.simulated ? 'Simulated route' : 'Road route'}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setView('map')}>
                  Expand
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="p-2.5">
              <UttarakhandMap heightClass="h-[500px]" />
            </div>
          </Card>

          <RouteComparison />
        </div>

        <div className="space-y-4">
          <TruckPanel />
          <RouteStopList />
        </div>
      </div>

      <AnalyticsCharts compact />
    </div>
  );
}
