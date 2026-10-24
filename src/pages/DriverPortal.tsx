import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Clock3, Fuel, LogOut, MapPin, Navigation, Pause, Play, Route, Truck } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { UttarakhandMap } from '../components/UttarakhandMap';
import { Badge, Button, Card } from '../components/ui';
import { DEPOT } from '../data/mockStops';
import { pointAtFraction } from '../lib/geo';
import { DEPOT_NODE } from '../lib/routeOptimizer';
import type { RoutePlan } from '../types';

const vehicles = [
  { id: 'TRK-01', name: 'Mini collection truck', size: 'Compact · 2.0 m', capacity: 500, fuel: 'Diesel · 78%', narrow: true },
  { id: 'TRK-02', name: 'Heavy collection truck', size: 'Large · 2.5 m', capacity: 2000, fuel: 'Diesel · 64%', narrow: false },
];

const DRIVER_ASSIGNMENTS = {
  driver01: {
    name: 'Driver 01',
    truckId: 'TRK-02',
  },
  driver02: {
    name: 'Driver 02',
    truckId: 'TRK-01',
  },
};

function nearestRouteMatch(position: { lat: number; lng: number }, geometry: { lat: number; lng: number }[]) {
  if (geometry.length < 2) return { fraction: 0, distanceMeters: Number.POSITIVE_INFINITY };
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  geometry.forEach((point, index) => {
    const distance = distanceMeters(position, point);
    if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
  });
  return { fraction: nearestIndex / (geometry.length - 1), distanceMeters: nearestDistance };
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getRouteWaypoints(plan: RoutePlan | null): { id: string; fraction: number; depot: boolean }[] {
  if (!plan || plan.distanceKm <= 0) return [];
  let travelledKm = 0;
  return plan.legs.map((leg) => {
    travelledKm += leg.distanceKm;
    return {
      id: leg.toId,
      fraction: Math.min(1, travelledKm / plan.distanceKm),
      depot: leg.toId === DEPOT_NODE,
    };
  });
}

function trimRouteGeometry(geometry: { lat: number; lng: number }[], maxPoints = 180) {
  if (geometry.length <= maxPoints) return geometry;
  return Array.from({ length: maxPoints }, (_, index) =>
    geometry[Math.round(index * (geometry.length - 1) / (maxPoints - 1))],
  );
}

export function DriverPortal({ driverId, onLogout }: { driverId: 'driver01' | 'driver02'; onLogout: () => void }) {
  const { stops, plans, routing, optimizeRouteForStops, updatePickupStatus, notify, selectStop, fitRoute, setCapacityKg, startDriverTracking, updateDriverTracking, stopDriverTracking, driverTracking, trackingConnected, driverAssignmentDetails } = useApp();
  const defaultAssignment = DRIVER_ASSIGNMENTS[driverId];
  const adminAssignment = driverAssignmentDetails[driverId];
  const truckId = adminAssignment.truckId ?? defaultAssignment.truckId;
  const [selectedArea, setSelectedArea] = useState('all');
  const assignment = { ...defaultAssignment, area: selectedArea === 'all' ? 'All available areas' : selectedArea, planId: 'optimized' as const };
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const capacity = truckId === 'TRK-01' ? 500 : 2000;
  const [optimized, setOptimized] = useState(false);
  const [started, setStarted] = useState(false);
  const [navigationProgress, setNavigationProgress] = useState(0);
  const [loadKg, setLoadKg] = useState(0);
  const [hasLiveGps, setHasLiveGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [reason, setReason] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const [handled, setHandled] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(`driver-handled-stops-${driverId}`) ?? '[]') as string[]; } catch { return []; }
  });
  const truck = vehicles.find((item) => item.id === truckId)!;
  const availableStops = (stop: (typeof stops)[number]) => stop.quantityKg > 0 && stop.emptiedByDriver !== true && !(handled.includes(stop.id) && stop.status === 'In Progress');
  const availableAreas = useMemo(() => [...new Set(stops
    .filter(availableStops)
    .map((stop) => stop.area))].sort(), [stops, handled]);
  const assignedStops = useMemo(() => stops.filter((stop) => selectedArea === 'all' || stop.area === selectedArea), [selectedArea, stops]);
  const routeStops = useMemo(() => assignedStops.filter(availableStops), [assignedStops, handled]);
  const assignedIds = useMemo(() => routeStops.map((stop) => stop.id), [routeStops]);
  const plan = plans.optimized;
  const planRef = useRef(plan);
  const processedDepotCount = useRef(0);
  const navigationPlan = started ? (planRef.current ?? plan) : plan;
  const plannedAssignedIds = (plan?.stopOrder ?? []).filter((id) => assignedIds.includes(id));
  const routeReady = optimized && !routing.loading && assignedIds.length > 0 && plan?.stopOrder.length === assignedIds.length && plannedAssignedIds.length === assignedIds.length && Boolean(plan && plan.geometry.length >= 2);
  const orderedStops = useMemo(() => {
    const planned = (navigationPlan?.stopOrder ?? []).map((id) => routeStops.find((s) => s.id === id)).filter((s): s is (typeof stops)[number] => Boolean(s));
    return planned.length ? planned : routeStops;
  }, [navigationPlan, routeStops]);
  const next = orderedStops[0] ?? null;
  const routeWaypoints = useMemo(() => getRouteWaypoints(navigationPlan), [navigationPlan]);
  const remainingCapacity = Math.max(0, capacity - loadKg);
  const areaCompleted = assignedStops.filter((stop) => stop.emptiedByDriver === true || stop.quantityKg <= 0).length + assignedStops.filter((stop) => handled.includes(stop.id) && stop.emptiedByDriver !== true && stop.quantityKg > 0).length;
  const nextFraction = navigationPlan && next && navigationPlan.distanceKm > 0 ? (navigationPlan.arrivalKm[next.id] ?? 0) / navigationPlan.distanceKm : 1;
  const gpsDistanceToNext = driverTracking && next ? distanceMeters(driverTracking.position, next) : null;
  const arrivedAtNext = hasLiveGps
    ? navigationProgress >= nextFraction || (gpsDistanceToNext !== null && gpsDistanceToNext <= Math.max(150, (driverTracking?.accuracyMeters ?? 50) * 2))
    : navigationProgress >= nextFraction;
  const upcomingDepot = routeWaypoints.find((waypoint) => waypoint.depot && waypoint.fraction > navigationProgress + 0.0005);
  const movementTargetFraction = upcomingDepot && (!next || upcomingDepot.fraction < nextFraction)
    ? upcomingDepot.fraction
    : next ? nextFraction : upcomingDepot?.fraction ?? 1;
  const movementTargetRef = useRef(movementTargetFraction);
  const reachedStopRef = useRef(false);
  const gpsWatch = useRef<number | null>(null);
  const navigationProgressRef = useRef(navigationProgress);
  useEffect(() => { navigationProgressRef.current = navigationProgress; }, [navigationProgress]);
  useEffect(() => { movementTargetRef.current = movementTargetFraction; }, [movementTargetFraction]);
  useEffect(() => { reachedStopRef.current = Boolean(started && next && arrivedAtNext); }, [started, next?.id, arrivedAtNext]);
  useEffect(() => { if (!started) planRef.current = plan; }, [plan, started]);

  useEffect(() => {
    if (!started) return;
    const reachedDepots = routeWaypoints.filter((waypoint) => waypoint.depot && waypoint.fraction <= navigationProgress + 0.0005).length;
    if (reachedDepots <= processedDepotCount.current) return;
    processedDepotCount.current = reachedDepots;
    setLoadKg(0);
    notify('Truck reached the depot and unloaded its collected waste.', 'success');
  }, [started, routeWaypoints, navigationProgress, notify]);

  useEffect(() => {
    if (!started || next || navigationProgress < 0.999) return;
    stopDriverTracking();
    setStarted(false);
    setLoadKg(0);
    notify('All assigned bins are handled and the truck has returned to the depot.', 'success');
  }, [started, next, navigationProgress, stopDriverTracking, notify]);

  useEffect(() => {
    if (!started || paused) return;
    if (!window.isSecureContext) {
      setHasLiveGps(false);
      setGpsError('Live GPS requires HTTPS on this device. Simulated route tracking is active.');
      return;
    }
    if (!navigator.geolocation) {
      setHasLiveGps(false);
      setGpsError('This browser does not provide GPS location. Simulated route tracking is active.');
      return;
    }
    setGpsError(null);
    gpsWatch.current = navigator.geolocation.watchPosition(
      (position) => {
        if (reachedStopRef.current) return;
        const livePosition = { lat: position.coords.latitude, lng: position.coords.longitude };
        const currentPlan = planRef.current;
        const currentProgress = navigationProgressRef.current;
        const routeMatch = currentPlan ? nearestRouteMatch(livePosition, currentPlan.geometry) : null;
        const allowedDistance = Math.max(250, Math.min(750, position.coords.accuracy * 2));
        if (!routeMatch || position.coords.accuracy > 500 || routeMatch.distanceMeters > allowedDistance) {
          setHasLiveGps(false);
          setGpsError('Device GPS is too far from the planned route. Simulated tracking will continue until it matches.');
          return;
        }
        setHasLiveGps(true);
        setGpsError(null);
        const routeProgress = Math.min(
          movementTargetRef.current,
          Math.max(currentProgress, Math.min(routeMatch.fraction, currentProgress + 0.03)),
        );
        setNavigationProgress(routeProgress);
        updateDriverTracking(
          livePosition,
          routeProgress,
          false,
          position.coords.accuracy,
        );
      },
      (error) => {
        setHasLiveGps(false);
        setGpsError(`${error.message || 'Location unavailable'} Simulated route tracking is active.`);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    return () => { if (gpsWatch.current !== null) navigator.geolocation.clearWatch(gpsWatch.current); };
  }, [started, paused, updateDriverTracking]);

  useEffect(() => {
    if (!started || paused || hasLiveGps || !navigationPlan || navigationProgress >= movementTargetFraction) return;
    const timer = window.setInterval(() => {
      setNavigationProgress((current) => {
        const nextProgress = Math.min(movementTargetFraction, current + 0.004);
        const point = pointAtFraction(navigationPlan.geometry, nextProgress);
        updateDriverTracking({ lat: point.lat, lng: point.lng }, nextProgress, true);
        return nextProgress;
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [started, paused, hasLiveGps, navigationPlan, navigationProgress, movementTargetFraction, updateDriverTracking]);

  function markCollection(status: 'Completed' | 'In Progress', binEmpty = false) {
    if (!next) return;
    const note = binEmpty
      ? `${next.note}${next.note ? ' · ' : ''}Driver report: bin already empty`
      : status === 'In Progress'
      ? `${next.note}${next.note ? ' · ' : ''}Driver report: ${reason || 'Collection issue'}`
      : undefined;
    updatePickupStatus(next.id, status, note, binEmpty ? 0 : undefined, status === 'Completed' && !binEmpty);
    if (status === 'Completed' && !binEmpty) setLoadKg((current) => current + next.quantityKg);
    if (status !== 'Completed') {
      const nextHandled = [...new Set([...handled, next.id])];
      setHandled(nextHandled);
      window.localStorage.setItem(`driver-handled-stops-${driverId}`, JSON.stringify(nextHandled));
    }
    if (binEmpty) notify(`${next.name} is empty; it was removed from the collection route.`, 'info');
    else if (status === 'Completed') notify(`${next.name} marked as emptied. ${next.quantityKg} kg recorded.`, 'success');
    else notify(`${next.name} recorded as not empty${reason ? `: ${reason}` : ''}.`, 'info');
    setReason('');
  }
  function reportIssue() {
    notify(`Issue recorded for ${next?.name ?? 'collection stop'}: ${reason || 'Access issue'}.`, 'info');
    if (next) {
      updatePickupStatus(next.id, 'In Progress', `${next.note}${next.note ? ' · ' : ''}Driver issue: ${reason || 'Access issue'}`);
      const nextHandled = [...new Set([...handled, next.id])];
      setHandled(nextHandled);
      window.localStorage.setItem(`driver-handled-stops-${driverId}`, JSON.stringify(nextHandled));
    }
    setIssueOpen(false); setReason('');
  }

  return <div className="min-h-screen bg-transparent">
    <section className="mx-auto min-h-screen max-w-[1500px] bg-transparent">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#102b25]/90 px-4 py-4 text-white shadow-lg backdrop-blur-2xl sm:px-6">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-400/15 p-2 text-emerald-300"><Truck className="h-5 w-5" /></div><div><p className="text-sm font-bold">Driver Portal</p><p className="text-[11px] text-emerald-100/70">Himalaya Route · Field collection</p></div></div>
        <Button variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => { stopDriverTracking(); setStarted(false); onLogout(); }}><LogOut className="h-4 w-4"/> Logout</Button>
      </header>
      <div className="grid gap-4 p-3 sm:p-5 lg:grid-cols-[350px_minmax(0,1fr)]">
        <div className="space-y-4 lg:max-h-[calc(100vh-150px)] lg:overflow-y-auto lg:pr-1">
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signed in driver</p>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900">{assignment.name}</h2>
            <label htmlFor="driver-area-choice" className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Choose cleanup area</label>
            <select id="driver-area-choice" value={selectedArea} disabled={started} onChange={(event) => { setSelectedArea(event.target.value); setOptimized(false); setNavigationProgress(0); }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 disabled:bg-slate-100">
              <option value="all">All available areas ({stops.filter(availableStops).length} active bins)</option>
              {availableAreas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {[["Assigned truck", `${truck.id} · ${truck.name}`], ["Truck capacity", `${truck.capacity.toLocaleString()} kg`], ["Assigned route", assignment.planId === 'optimized' ? 'Optimized collection route' : 'Baseline collection route'], ["Assigned area", assignment.area]].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-2.5" key={label}><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value}</p></div>)}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-forest-100 bg-forest-50/70 px-3 py-2 text-xs"><span className="text-forest-800">Live tracking number</span><b className="font-mono text-forest-900">{trackingId ?? (driverTracking?.truckId ?? 'Assigned at start')}</b></div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-forest-50 p-3 text-xs"><span className="text-forest-800">Load / available capacity</span><b className="text-forest-900">{loadKg} / {remainingCapacity} kg free</b></div>
            {!optimized ? <Button className="mt-4 h-12 w-full" disabled={assignedIds.length === 0} onClick={() => { setCapacityKg(capacity); optimizeRouteForStops(assignedIds); setOptimized(true); fitRoute(); }}> <Route className="h-4 w-4"/> Prepare Optimized Route</Button> : <div className="mt-4 grid grid-cols-2 gap-2"><Button className="h-11" onClick={() => { if (!started) { const origin = plan?.geometry[0] ?? DEPOT; planRef.current = plan; processedDepotCount.current = 0; setLoadKg(0); setNavigationProgress(0); setHasLiveGps(false); const id = startDriverTracking(truck.name, { lat: origin.lat, lng: origin.lng }, true, truck.id, truck.capacity, trimRouteGeometry(plan?.geometry ?? [])); setTrackingId(id); } else { updateDriverTracking(driverTracking?.position ?? DEPOT, navigationProgress, !hasLiveGps); } setStarted(true); setPaused(false); if (next) selectStop(next.id); }} disabled={!routeReady && !started}>{!routeReady && !started ? <><Clock3 className="h-4 w-4"/>Preparing route…</> : <><Navigation className="h-4 w-4"/>{started ? 'Resume route' : 'Start navigation'}</>}</Button><Button variant="outline" className="h-11" onClick={() => { setOptimized(false); optimizeRouteForStops(assignedIds); setOptimized(true); notify('Area route re-optimized.', 'success'); }} disabled={assignedIds.length === 0 || started}><Route className="h-4 w-4"/>Recalculate</Button></div>}
          </Card>

          <Card className="p-4"><div className="flex items-center justify-between"><h3 className="font-display text-sm font-bold text-slate-900">Route progress</h3><span className="text-xs font-semibold text-forest-700">{areaCompleted} of {assignedStops.length} handled</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{width:`${assignedStops.length ? areaCompleted / assignedStops.length * 100 : 0}%`}}/></div><div className="mt-3 flex justify-between text-[11px] text-slate-500"><span>{plan?.distanceKm.toFixed(1) ?? '—'} km route</span><span><Clock3 className="mr-1 inline h-3 w-3"/>{plan?.durationMin.toFixed(0) ?? '—'} min est.</span></div></Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-sm font-bold text-slate-900">Assigned non-empty stops</h3><span className="text-[10px] text-slate-400">{orderedStops.length} stops</span></div>
            <div className="space-y-2">{orderedStops.map((stop, index) => <div key={stop.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3">
              <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{index + 1}. {stop.name}</p><p className="mt-1 truncate text-[10px] text-slate-500">{stop.area} · {stop.quantityKg} kg · {stop.fillPercent ?? (/full bin/i.test(stop.note) ? 100 : 55)}% full</p></div>
              <Badge tone={stop.emptiedByDriver === true ? 'green' : stop.status === 'In Progress' ? 'amber' : 'slate'}>{stop.emptiedByDriver === true ? 'Completed' : stop.status === 'Completed' ? 'Pending collection' : stop.status}</Badge>
            </div>)}</div>
          </Card>

          {next ? <Card className="border-amber-200 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{started ? 'Next collection point' : 'First collection point'}</p><h3 className="mt-1 font-display text-base font-bold text-slate-900">{next.name}</h3><p className="mt-1 text-xs text-slate-500"><MapPin className="mr-1 inline h-3.5 w-3.5"/>{next.area} · {next.quantityKg} kg · {next.priority} priority</p><p className="mt-2 text-xs text-slate-600">{started ? (hasLiveGps && gpsDistanceToNext !== null ? `${(gpsDistanceToNext / 1000).toFixed(2)} km to stop by GPS` : `${Math.max(0, ((nextFraction - navigationProgress) * (plan?.distanceKm ?? 0))).toFixed(1)} km remaining on simulated route`) : 'Start navigation to receive turn-by-turn demo guidance.'}</p>{started && <p className="mt-2 text-[10px] font-semibold text-forest-700">{hasLiveGps ? `● Live device GPS · ±${Math.round(driverTracking?.accuracyMeters ?? 0)} m` : '● Simulated GPS'} · {driverTracking?.position.lat.toFixed(4)}, {driverTracking?.position.lng.toFixed(4)}</p>}{started && gpsError && <p role="status" className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] leading-4 text-amber-800">{gpsError} Check location permission and device location services.</p>}{started && arrivedAtNext && <div className="mt-3 grid grid-cols-2 gap-2"><Button className="min-h-12" onClick={() => markCollection('Completed')}><Check className="h-4 w-4"/>Mark dustbin empty</Button><Button variant="amber" className="min-h-12" onClick={() => setIssueOpen(true)}><AlertTriangle className="h-4 w-4"/>Report an issue</Button></div>}{started && <Button variant="outline" className="mt-2 h-10 w-full" onClick={() => setPaused((v)=>!v)}>{paused ? <Play className="h-4 w-4"/> : <Pause className="h-4 w-4"/>}{paused ? 'Resume navigation' : 'Pause navigation'}</Button>}</Card> : <Card className="p-5 text-center"><Check className="mx-auto h-7 w-7 text-emerald-600"/><h3 className="mt-2 font-bold text-slate-900">No non-empty assigned bins to visit</h3><p className="mt-1 text-xs text-slate-500">This truck does not need to navigate until an assigned dustbin has waste to collect.</p>{started && <Button className="mt-3 w-full" onClick={() => { stopDriverTracking(); setStarted(false); notify('No non-empty collection stops remain. Truck tracking ended.', 'success'); }}>End navigation</Button>}</Card>}
          <p className="px-1 text-[10px] leading-4 text-slate-400"><Fuel className="mr-1 inline h-3 w-3"/>{trackingConnected ? 'Shared fleet connection is online across devices.' : 'Shared fleet connection is offline; connect Upstash Redis in Vercel or start the local tracking server.'} GPS is live only when HTTPS and device permission are available; otherwise route movement is simulated.</p>
        </div>
        <div className="min-h-[440px] overflow-hidden rounded-2xl lg:min-h-[calc(100vh-150px)]"><UttarakhandMap heightClass="h-[520px] lg:h-[calc(100vh-150px)]" showTruck={false} planId="optimized" stopIds={assignedStops.map((stop) => stop.id)} focusTruckId={truck.id}/></div>
      </div>
      {issueOpen && <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4"><Card className="w-full max-w-sm p-5"><h3 className="font-display font-bold text-slate-900">Collection issue</h3><p className="mt-1 text-xs text-slate-500">Record why this stop could not be emptied.</p><select value={reason} onChange={(e)=>setReason(e.target.value)} className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Choose an issue</option><option>Bin already empty</option><option>Blocked road / inaccessible</option><option>Damaged dustbin</option><option>Other</option></select>{reason === 'Other' && <input onChange={(e)=>setReason(e.target.value)} placeholder="Describe issue" className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"/>}<div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" onClick={()=>setIssueOpen(false)}>Cancel</Button><Button onClick={()=>{ if(reason==='Bin already empty') markCollection('Completed', true); else reportIssue(); }}>Save status</Button></div></Card></div>}
    </section>
  </div>;
}
