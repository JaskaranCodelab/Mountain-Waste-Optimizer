import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  ScaleControl,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Layers3,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  MountainSnow,
  Navigation,
  Route as RouteIcon,
  Satellite,
  Scan,
  WifiOff,
} from 'lucide-react';
import {
  ACCESSIBILITY_META,
  DEPOT,
  WASTE_TYPE_META,
} from '../data/mockStops';
import { useApp } from '../store/AppStore';
import type {
  LatLng,
  RoutePlan,
  RoutePlanId,
  SimulationStatus,
  Stop,
} from '../types';
import {
  formatDuration,
  formatKm,
  formatNumber,
  pointAtFraction,
  splitPolylineAtFraction,
} from '../lib/geo';
import { Badge, Button, cn, type BadgeTone } from './ui';

interface MapTruck {
  id: string;
  name: string;
  type: string;
  capacityKg: number;
  fuel: string;
  bestFor: string;
  planId: RoutePlanId;
  plan: RoutePlan;
  progress: number;
  status: SimulationStatus;
  color: string;
  position: LatLng;
  nextStop: Stop | null;
  coveredStops: number;
}

function fleetTruckIcon(
  id: string,
  color: string,
  capacityKg: number,
): L.DivIcon {
  const isLarge = capacityKg >= 1500;
  const size = isLarge ? 46 : 36;
  const glyph = isLarge ? 23 : 18;
  return L.divIcon({
    className: 'himalaya-div-icon',
    html: `<div class="truck-pin ${isLarge ? 'truck-pin-large' : 'truck-pin-small'}" style="--truck-accent:${color};--truck-ring:${color}33"><span class="truck-tag">${id.split('-')[1] ?? ''}</span><svg width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1"/><path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-1"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 18h6"/></svg></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, isLarge ? -28 : -22],
  });
}

const MAP_MODES = {
  terrain: {
    label: 'Terrain',
    icon: MapIcon,
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 19,
    maxNativeZoom: 17,
  },
  satellite: {
    label: 'Satellite',
    icon: Satellite,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  },
  mountain: {
    label: 'Mountain',
    icon: MountainSnow,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, USGS, NGA, EPA, and the GIS User Community',
    maxZoom: 19,
  },
} as const;

type MapMode = keyof typeof MAP_MODES;

const USER_ICON = L.divIcon({
  className: 'himalaya-div-icon',
  html: '<div class="user-pin"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function stopIcon(stop: Stop, sequence: number, selected: boolean): L.DivIcon {
  const completed = stop.status === 'Completed';
  const classes = [
    'stop-pin',
    `priority-${stop.priority}`,
    selected ? 'is-selected' : '',
    completed ? 'is-completed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return L.divIcon({
    className: 'himalaya-div-icon',
    html: `<div class="${classes}"><svg class="stop-bin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg><span class="stop-seq">${sequence}</span>${
      completed ? '<span class="stop-check">✓</span>' : ''
    }</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}

function MapNavigator({
  fitPoints,
  fitRequest,
  routeKey,
  selected,
}: {
  fitPoints: LatLng[];
  fitRequest: number;
  routeKey: string;
  selected: Stop | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (fitPoints.length === 0) {
      return;
    }
    const bounds = L.latLngBounds(
      fitPoints.map((point) => L.latLng(point.lat, point.lng)),
    );
    map.fitBounds(bounds, { padding: [46, 46], maxZoom: 14 });
  }, [fitRequest, routeKey, fitPoints, map]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    const currentZoom = map.getZoom();
    map.flyTo(
      [selected.lat, selected.lng],
      Math.max(currentZoom, 13),
      { duration: 0.7 },
    );
  }, [selected?.id, selected?.lat, selected?.lng, map]);

  return null;
}

function MapAutoResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function DriverMapFollow({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo([position.lat, position.lng], { animate: true, duration: 0.45 });
  }, [position?.lat, position?.lng, map]);
  return null;
}

function statusTone(status: Stop['status']): BadgeTone {
  if (status === 'Completed') {
    return 'green';
  }
  if (status === 'In Progress') {
    return 'amber';
  }
  return 'slate';
}

function priorityTone(priority: Stop['priority']): BadgeTone {
  if (priority === 'high') {
    return 'red';
  }
  if (priority === 'medium') {
    return 'amber';
  }
  return 'teal';
}

export function UttarakhandMap({
  heightClass = 'h-[520px]',
  showTruck = true,
  planId,
  stopIds,
}: {
  heightClass?: string;
  showTruck?: boolean;
  planId?: RoutePlanId;
  stopIds?: string[];
}) {
  const {
    stops,
    plans,
    activePlanId,
    routing,
    selectedStopId,
    selectStop,
    fleet,
    selectedTruckId,
    selectTruck,
    fitRequest,
    fitRoute,
    retryRouting,
    userLocation,
    settings,
    completedCount,
    notify,
    driverTrackings,
  } = useApp();
  const visibleStops = useMemo(
    () => (stopIds ? stops.filter((stop) => stopIds.includes(stop.id)) : stops),
    [stops, stopIds?.join('|')],
  );
  const activePlan = plans[planId ?? activePlanId];
  const [showBaseline, setShowBaseline] = useState(() => !planId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('terrain');
  const mapShellRef = useRef<HTMLDivElement>(null);
  const activeMapMode = MAP_MODES[mapMode];

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mapShellRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    const element = mapShellRef.current;
    if (!element) {
      return;
    }
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
        return;
      }
      if (!element.requestFullscreen) {
        notify('Full screen is not supported by this browser.', 'error');
        return;
      }
      await element.requestFullscreen();
    } catch {
      notify('Full screen could not be opened.', 'error');
    }
  }

  const selectedStop = visibleStops.find((stop) => stop.id === selectedStopId) ?? null;
  const routeOrder = activePlan?.stopOrder ?? visibleStops.map((stop) => stop.id);
  const sequenceById = useMemo(() => {
    const map = new Map<string, number>();
    routeOrder.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [routeOrder]);

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    visibleStops.forEach((stop, index) => {
      map.set(
        stop.id,
        stopIcon(
          stop,
          sequenceById.get(stop.id) ?? index + 1,
          stop.id === selectedStopId,
        ),
      );
    });
    return map;
  }, [visibleStops, selectedStopId, sequenceById]);

  const fitPointsKey = visibleStops
    .map((stop) => `${stop.id}:${stop.lat}:${stop.lng}`)
    .join('|');
  const fitPoints = useMemo<LatLng[]>(
    () => [
      { lat: DEPOT.lat, lng: DEPOT.lng },
      ...visibleStops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
    ],
    [fitPointsKey],
  );

  const routeKey = activePlan
    ? `${activePlan.id}-${activePlan.stopOrder.join('>')}-${activePlan.distanceKm.toFixed(2)}`
    : 'no-route';

  const otherPlan = planId
    ? null
    : activePlanId === 'optimized'
      ? plans.baseline
      : plans.optimized;

  const activeColor = activePlan?.simulated ? '#b45309' : '#1a5239';
  const activeDash = activePlan?.simulated ? '10 8' : undefined;

  const trucks = useMemo<MapTruck[]>(() => {
    if (!showTruck || !fleet.length) {
      return [];
    }
    return fleet
      .filter((truck) => !driverTrackings.some((liveTruck) => liveTruck.truckId === truck.id))
      .filter((truck) => (planId ? truck.planId === planId : true))
      .flatMap((truck) => {
        const plan = plans[truck.planId];
        if (!plan || plan.geometry.length < 2) {
          return [];
        }
        const point = pointAtFraction(plan.geometry, truck.progress);
        const total = plan.distanceKm > 0 ? plan.distanceKm : 1;
        const nextStopId =
          plan.stopOrder.find(
            (stopId) =>
              (plan.arrivalKm[stopId] ?? 0) / total > truck.progress + 1e-7,
          ) ?? null;
        const coveredStops = plan.stopOrder.filter(
          (stopId) =>
            (plan.arrivalKm[stopId] ?? 0) / total <= truck.progress + 1e-7,
        ).length;
        return [
          {
            id: truck.id,
            name: truck.name,
            type: truck.type,
            capacityKg: truck.capacityKg,
            fuel: truck.fuel,
            bestFor: truck.bestFor,
            planId: truck.planId,
            plan,
            progress: truck.progress,
            status: truck.status,
            color: truck.color,
            position: { lat: point.lat, lng: point.lng },
            nextStop: nextStopId
              ? stops.find((stop) => stop.id === nextStopId) ?? null
              : null,
            coveredStops,
          },
        ];
      });
  }, [fleet, planId, plans, showTruck, stops, driverTrackings]);

  const truckIcons = useMemo(() => {
    const icons = new Map<string, L.DivIcon>();
    fleet.forEach((truck) => {
      icons.set(
        truck.id,
        fleetTruckIcon(truck.id, truck.color, truck.capacityKg),
      );
    });
    return icons;
  }, [
    fleet
      .map((truck) => `${truck.id}:${truck.color}:${truck.capacityKg}`)
      .join('|'),
  ]);

  const mapSourceLabel = routing.loading
    ? 'Loading road geometry…'
    : routing.source === 'osrm'
      ? 'OpenStreetMap road route'
      : routing.source === 'mixed'
        ? 'Partially simulated route'
        : routing.source === 'simulated'
          ? 'Simulated route • no road data'
          : 'Awaiting route';

  return (
    <div
      ref={mapShellRef}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-card',
        isFullscreen ? 'h-screen rounded-none border-0' : heightClass,
      )}
    >
      <MapContainer
        center={[30.4466, 78.0759]}
        zoom={13}
        zoomControl={false}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          key={mapMode}
          attribution={activeMapMode.attribution}
          url={activeMapMode.url}
          maxZoom={activeMapMode.maxZoom}
          maxNativeZoom={'maxNativeZoom' in activeMapMode ? activeMapMode.maxNativeZoom : undefined}
        />
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomright" imperial={false} />
        <MapNavigator
          fitPoints={fitPoints}
          fitRequest={fitRequest}
          routeKey={routeKey}
          selected={selectedStop}
        />
        <MapAutoResize />
        {driverTrackings[0] ? <DriverMapFollow position={driverTrackings[0].position} /> : null}

        {showBaseline && otherPlan ? (
          <Polyline
            positions={otherPlan.geometry}
            pathOptions={{
              color: '#64748b',
              weight: 2.5,
              opacity: 0.75,
              dashArray: '4 8',
            }}
          />
        ) : null}

        {(() => {
          const selectedTruck =
            selectedTruckId && fleet.length
              ? fleet.find(
                  (t) =>
                    t.id === selectedTruckId &&
                    (planId ? t.planId === planId : true),
                )
              : null;
          if (!selectedTruck) {
            return activePlan && activePlan.geometry.length > 1 ? (
              <>
                <Polyline
                  positions={activePlan.geometry}
                  pathOptions={{
                    color: '#ffffff',
                    weight: activePlan.simulated ? 8 : 9,
                    opacity: 0.55,
                  }}
                />
                <Polyline
                  positions={activePlan.geometry}
                  pathOptions={{
                    color: activeColor,
                    weight: activePlan.simulated ? 3.5 : 4.5,
                    opacity: 0.95,
                    dashArray: activeDash,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </>
            ) : null;
          }
          const plan = plans[selectedTruck.planId];
          if (!plan || plan.geometry.length < 2) {
            return null;
          }
          const { covered, pending } = splitPolylineAtFraction(
            plan.geometry,
            selectedTruck.progress,
          );
          return (
            <>
              {covered.length > 1 ? (
                <>
                  <Polyline
                    positions={covered}
                    pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.55 }}
                  />
                  <Polyline
                    positions={covered}
                    pathOptions={{
                      color: '#22c55e',
                      weight: 4.5,
                      opacity: 0.98,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                </>
              ) : null}
              {pending.length > 1 ? (
                <>
                  <Polyline
                    positions={pending}
                    pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.5 }}
                  />
                  <Polyline
                    positions={pending}
                    pathOptions={{
                      color: '#3b82f6',
                      weight: 3.5,
                      opacity: 0.95,
                      dashArray: '6 10',
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                </>
              ) : null}
            </>
          );
        })()}

        {visibleStops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={icons.get(stop.id)}
            zIndexOffset={stop.id === selectedStopId ? 1000 : 0}
            riseOnHover
            eventHandlers={{ click: () => selectStop(stop.id) }}
          >
            <Popup>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-700 text-[10px] font-bold text-white">
                    {sequenceById.get(stop.id) ?? '•'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[13px] font-semibold leading-tight text-slate-900">
                      {stop.name}
                    </p>
                    <p className="text-[10px] text-slate-500">{stop.area}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={priorityTone(stop.priority)}>
                    {stop.priority} priority
                  </Badge>
                  <Badge tone={statusTone(stop.status)}>{stop.status}</Badge>
                  <Badge tone="slate">
                    {WASTE_TYPE_META[stop.wasteType].shortLabel}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                  <div>
                    <p className="text-slate-400">Quantity</p>
                    <p className="font-semibold text-slate-700">
                      {formatNumber(stop.quantityKg)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Service time</p>
                    <p className="font-semibold text-slate-700">
                      {formatDuration(stop.serviceTimeMin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Access</p>
                    <p className="font-semibold text-slate-700">
                      {ACCESSIBILITY_META[stop.accessibility].label}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Order</p>
                    <p className="font-semibold text-slate-700">
                      #{sequenceById.get(stop.id) ?? '—'}
                    </p>
                  </div>
                </div>
                <p className="rounded-md bg-slate-50 px-2 py-1 text-[9px] leading-4 text-slate-400">
                  {stop.note}
                </p>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-600">
                  Simulated pickup • not a live record
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {trucks.map((truck) => {
          const isSelected = selectedTruckId === truck.id;
          return (
            <Marker
              key={truck.id}
              position={[truck.position.lat, truck.position.lng]}
              icon={truckIcons.get(truck.id)}
              zIndexOffset={isSelected ? 1400 : 1200}
              eventHandlers={{
                click: (event) => {
                  selectTruck(truck.id);
                  (event.target as L.Marker).openPopup();
                },
              }}
            >
              <Popup>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-forest-600">
                    Real-time fleet tracking
                  </p>
                  <p className="font-display text-sm font-semibold text-slate-900">
                    {truck.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {truck.id} • {truck.type} • {truck.fuel}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                      style={{ color: truck.color, background: `${truck.color}16` }}
                    >
                      {truck.plan.label} route
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                      {truck.status === 'running' ? 'Moving slowly' : truck.status}
                    </span>
                    {isSelected ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                    <div>
                      <p className="text-slate-400">Capacity</p>
                      <p className="font-semibold text-slate-700">
                        {formatNumber(truck.capacityKg)} kg
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Progress</p>
                      <p className="font-semibold text-slate-700">
                        {(truck.progress * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Travelled</p>
                      <p className="font-semibold text-slate-700">
                        {formatKm(truck.plan.distanceKm * truck.progress)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Fuel</p>
                      <p className="font-semibold text-slate-700">
                        {truck.fuel}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">Best for</p>
                      <p className="font-semibold text-slate-700">
                        {truck.bestFor}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">Route covered</p>
                      <p className="font-semibold text-slate-700">
                        {truck.coveredStops} / {truck.plan.stopOrder.length}{' '}
                        stops • {truck.plan.label}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">Next stop</p>
                      <p className="font-semibold text-slate-700">
                        {truck.nextStop
                          ? `${truck.nextStop.name} • ${truck.nextStop.area}`
                          : 'Returning to depot'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      selectTruck(truck.id);
                      fitRoute();
                    }}
                    className="w-full rounded-lg bg-forest-700 px-2 py-1.5 text-[10px] font-semibold text-white transition hover:bg-forest-800"
                  >
                    Track this truck
                  </button>
                  <p className="pt-1 text-[9px] leading-4 text-amber-600">
                    Covered route shown in green, pending in blue when selected.
                    Simulation only • not live GPS.
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {driverTrackings.map((driverTruck) => (
          <Marker
            key={`driver-live-${driverTruck.trackingKey}`}
            position={[driverTruck.position.lat, driverTruck.position.lng]}
            icon={fleetTruckIcon(driverTruck.truckId, '#16a34a', driverTruck.capacityKg ?? (driverTruck.truckId === 'TRK-02' ? 2000 : 500))}
            zIndexOffset={1800}
          >
            <Popup>
              <div className="space-y-1.5">
                <p className="font-display text-[13px] font-bold text-slate-900">{driverTruck.truckName}</p>
                <p className="text-[10px] font-semibold text-forest-700">{driverTruck.truckId} · Driver navigation active</p>
                <p className="text-[10px] text-slate-500">{driverTruck.simulated ? 'Simulated GPS location' : 'Live device GPS location'}</p>
                {!driverTruck.simulated && driverTruck.accuracyMeters !== undefined ? <p className="text-[10px] text-slate-500">Reported accuracy: ±{Math.round(driverTruck.accuracyMeters)} m</p> : null}
                <p className="font-mono text-[9px] text-slate-400">{driverTruck.position.lat.toFixed(5)}, {driverTruck.position.lng.toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON}>
            <Popup>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">
                  Device location
                </p>
                <p className="text-[11px] text-slate-600">
                  Shared with browser permission. Not a truck GPS feed.
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[800]">
        <div className="pointer-events-auto absolute left-3 top-3 max-w-[260px] space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
            {routing.loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-forest-600" />
            ) : routing.source === 'osrm' ? (
              <RouteIcon className="h-3.5 w-3.5 text-forest-600" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold text-slate-700">
                {mapSourceLabel}
              </p>
              <p className="text-[9px] text-slate-400">
                {activePlan ? activePlan.provider : 'Waiting for plan'} •{' '}
                {completedCount}/{stops.length} stops done
              </p>
            </div>
          </div>
          {!routing.loading && routing.source === 'simulated' ? (
            <div className="pointer-events-auto rounded-lg border border-amber-200 bg-amber-50/95 px-2.5 py-1.5 text-[9px] leading-4 text-amber-800 shadow-sm backdrop-blur">
              <span className="font-semibold">Fallback active.</span> Lines are
              simulated estimates, not real mountain roads.
              <button
                type="button"
                onClick={retryRouting}
                className="ml-1 font-semibold underline decoration-amber-400 underline-offset-2"
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFullscreen}
            className="bg-white/95 backdrop-blur"
            title={isFullscreen ? 'Exit full screen map' : 'Open the map in full screen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fitRoute}
            disabled={!activePlan}
            className="bg-white/95 backdrop-blur"
            title="Fit all stops and route in view"
          >
            <Scan className="h-3.5 w-3.5" />
            Fit Route
          </Button>
          {!planId ? (
            <Button
              size="sm"
              variant={showBaseline ? 'secondary' : 'outline'}
              onClick={() => setShowBaseline((previous) => !previous)}
              className="bg-white/95 backdrop-blur"
              disabled={!otherPlan}
              title="Toggle the comparison route overlay"
              aria-pressed={showBaseline}
            >
              <Layers3 className="h-3.5 w-3.5" />
              {showBaseline ? 'Hide comparison' : 'Compare route'}
            </Button>
          ) : null}
        </div>

        <div className="pointer-events-auto absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-sm backdrop-blur">
          <span className="px-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Map
          </span>
          {(Object.keys(MAP_MODES) as MapMode[]).map((mode) => {
            const config = MAP_MODES[mode];
            const ModeIcon = config.icon;
            const active = mapMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setMapMode(mode)}
                aria-pressed={active}
                aria-label={`${config.label} map mode`}
                title={`Switch to ${config.label.toLowerCase()} map`}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-semibold transition-colors',
                  active
                    ? 'bg-forest-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <ModeIcon className="h-3 w-3" />
                {config.label}
              </button>
            );
          })}
        </div>

        {routing.loading ? (
          <div className="pointer-events-none absolute inset-0 z-[810] flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-forest-600" />
              Fetching road route…
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-[800] hidden items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[8px] text-slate-400 shadow-sm backdrop-blur sm:flex">
        <Navigation className="h-2.5 w-2.5" />
        Mussoorie • {stops.length} simulated stops • capacity{' '}
        {formatNumber(settings.capacityKg)} kg
      </div>
    </div>
  );
}
