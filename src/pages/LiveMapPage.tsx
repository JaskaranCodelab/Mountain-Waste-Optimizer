import { Map as MapIcon, Navigation, Radio, Satellite } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { RouteStopList } from '../components/RouteStopList';
import { TruckPanel } from '../components/TruckPanel';
import { UttarakhandMap } from '../components/UttarakhandMap';
import { Badge, Button, Card, SectionHeader } from '../components/ui';

export function LiveMapPage() {
  const {
    activePlan,
    routing,
    simulationStatus,
    selectedStopId,
    stops,
    fitRoute,
  } = useApp();
  const selected = stops.find((stop) => stop.id === selectedStopId);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Live map"
        title="Simulated fleet movement around Mussoorie"
        subtitle="Demo fleet trucks follow estimated routes. A driver truck can share live device GPS through the tracking server; simulated location is labeled on the map."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={routing.source === 'osrm' ? 'blue' : 'amber'}>
              <Satellite className="h-2.5 w-2.5" />
              {routing.source === 'osrm'
                ? 'Road-network geometry'
                : routing.source === 'mixed'
                  ? 'Mixed geometry'
                  : 'Simulated geometry'}
            </Badge>
            <Badge
              tone={
                simulationStatus === 'running'
                  ? 'green'
                  : simulationStatus === 'paused'
                    ? 'amber'
                    : 'slate'
              }
            >
              <Radio className="h-2.5 w-2.5" />
              {simulationStatus === 'running'
                ? 'Fleet running'
                : simulationStatus === 'paused'
                  ? 'Fleet paused'
                  : simulationStatus === 'complete'
                    ? 'Routes complete'
                    : 'Fleet staged at depot'}
            </Badge>
            <Button variant="outline" size="sm" onClick={fitRoute}>
              <MapIcon className="h-3.5 w-3.5" />
              Fit route
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(330px,1fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="font-display text-sm font-semibold text-slate-900">
                  {activePlan ? activePlan.label : 'Waiting for route'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {selected
                    ? `Focused on ${selected.name} • ${selected.area}`
                    : 'Both truck routes, Mussoorie pickups and device reference position'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  <Navigation className="h-2.5 w-2.5" />
                  Blue dot = your device (optional)
                </span>
              </div>
            </div>
            <div className="p-2.5">
              <UttarakhandMap heightClass="h-[600px]" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-400">
              <span>
                Driver location is live when device GPS is permitted; other fleet movement is simulated.
              </span>
              <span>Map tiles © OpenStreetMap contributors</span>
            </div>
          </Card>

          <RouteStopList />
        </div>

        <TruckPanel />
      </div>
    </div>
  );
}
