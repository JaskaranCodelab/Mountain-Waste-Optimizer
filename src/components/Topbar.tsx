import { useEffect, useState } from 'react';
import {
  Activity,
  MapPin,
  Menu,
  Mountain,
  PauseCircle,
  PlayCircle,
  Truck,
  LogOut,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import type { ViewId } from '../types';
import { cn } from './ui';

const PAGE_META: Record<ViewId, { title: string; subtitle: string }> = {
  overview: {
    title: 'Operations Overview',
    subtitle: 'Mountain waste collection control centre',
  },
  map: {
    title: 'Live Route Map',
    subtitle: 'Interactive Uttarakhand collection network',
  },
  planner: {
    title: 'Route Planner',
    subtitle: 'Baseline vs capacity-aware optimization',
  },
  compare: {
    title: 'Baseline vs Optimized',
    subtitle: 'Side-by-side route maps for the same dustbin network',
  },
  stops: {
    title: 'Pickup Stops',
    subtitle: 'Manage the simulated collection dataset',
  },
  analytics: {
    title: 'Collection Analytics',
    subtitle: 'Tonnes, distances and operating cost',
  },
  settings: {
    title: 'Settings & Assumptions',
    subtitle: 'Routing, cost model and simulation controls',
  },
};

function formatClock(date: Date): { dateLabel: string; timeLabel: string } {
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
  return { dateLabel, timeLabel };
}

export function Topbar({ onMenu, onLogout }: { onMenu: () => void; onLogout: () => void }) {
  const { view, simulationStatus, routing, fleet, driverTrackings } = useApp();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const meta = PAGE_META[view];
  const clock = formatClock(now);
  const activeTruckCount = new Set([...fleet.map((truck) => truck.id), ...driverTrackings.map((truck) => truck.truckId)]).size;

  const simLabel =
    simulationStatus === 'running'
      ? 'Simulation running'
      : simulationStatus === 'paused'
        ? 'Simulation paused'
        : simulationStatus === 'complete'
          ? 'Simulation complete'
          : 'Simulation ready';

  const simTone =
    simulationStatus === 'running'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : simulationStatus === 'paused'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : simulationStatus === 'complete'
          ? 'text-sky-700 bg-sky-50 border-sky-200'
          : 'text-slate-600 bg-slate-50 border-slate-200';

  const routingLive = routing.source === 'osrm';

  return (
    <header className="glass-topbar sticky top-0 z-30 border-b backdrop-blur-2xl">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 xl:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-9 w-9 items-center justify-center rounded-lg bg-forest-700 text-white sm:flex lg:hidden">
            <Mountain className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-[15px] font-semibold tracking-tight text-slate-900 sm:text-base">
                {meta.title}
              </h1>
              <span className="hidden rounded-full border border-forest-200 bg-forest-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-forest-700 xl:inline-flex">
                Demo
              </span>
            </div>
            <p className="hidden truncate text-[11px] text-slate-500 md:block">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onLogout} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-forest-700 px-3 text-[11px] font-semibold text-white shadow-sm transition hover:bg-forest-800 sm:px-3.5 sm:text-xs">
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
          <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 xl:flex">
            <MapPin className="h-3.5 w-3.5 text-forest-600" />
            Uttarakhand, India
            <span className="ml-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
              IST
            </span>
          </div>

          <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 md:flex">
            <Truck className="h-3.5 w-3.5 text-forest-600" />
            {activeTruckCount} trucks • Active
            <span
              className={cn(
                'ml-0.5 h-1.5 w-1.5 rounded-full',
                routingLive ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
          </div>

          <div
            className={cn(
              'hidden items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold sm:flex',
              simTone,
            )}
          >
            {simulationStatus === 'running' ? (
              <Activity className="h-3.5 w-3.5" />
            ) : simulationStatus === 'paused' ? (
              <PauseCircle className="h-3.5 w-3.5" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            {simLabel}
          </div>

          <div className="hidden rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-right lg:block">
            <p className="font-mono text-[11px] font-semibold leading-tight text-slate-800">
              {clock.timeLabel}
            </p>
            <p className="text-[9px] leading-tight text-slate-400">
              {clock.dateLabel}
            </p>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-100 text-xs font-bold text-forest-800 ring-1 ring-forest-200">
            HR
          </div>
        </div>
      </div>
    </header>
  );
}
