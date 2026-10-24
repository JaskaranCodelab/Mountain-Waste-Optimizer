import { ArrowUpRight } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { AnalyticsCharts } from '../components/AnalyticsCharts';
import { RouteComparison } from '../components/RouteComparison';
import { RouteStopList } from '../components/RouteStopList';
import { StatsCards } from '../components/StatsCards';
import { TruckPanel } from '../components/TruckPanel';
import { UttarakhandMap } from '../components/UttarakhandMap';
import { Badge, Button, Card } from '../components/ui';

export function OverviewPage() {
  const {
    activePlan,
    setView,
    fleet,
    driverTrackings,
  } = useApp();
  const activeTruckCount = new Set([...fleet.map((truck) => truck.id), ...driverTrackings.map((truck) => truck.truckId)]).size;

  return (
    <div className="space-y-5">
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
                  {activeTruckCount} active trucks, Mussoorie pickups and both route
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
