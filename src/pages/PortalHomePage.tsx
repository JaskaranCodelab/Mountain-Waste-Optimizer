import { ArrowRight, Mountain, ShieldCheck, Truck } from 'lucide-react';
import { Card } from '../components/ui';

export type PortalChoice = 'admin' | 'driver';

export function PortalHomePage({ onChoose }: { onChoose: (portal: PortalChoice) => void }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-24 -top-20 h-80 w-80 rounded-full bg-forest-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative w-full max-w-5xl">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-forest-800 text-white shadow-lg shadow-forest-900/20">
            <Mountain className="h-7 w-7" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-forest-700">Himalaya Route</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Waste collection, coordinated.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Choose a portal to continue to the mountain waste collection optimizer.</p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="group flex min-h-[260px] flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-forest-300 hover:shadow-xl sm:p-8">
            <div className="flex items-start justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-800"><ShieldCheck className="h-6 w-6" /></div>
              <span className="rounded-full border border-forest-100 bg-forest-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-forest-700">Operations</span>
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold text-slate-900">Admin Portal</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">Manage waste collection, trucks, drivers, routes, and analytics.</p>
            <button onClick={() => onChoose('admin')} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-forest-800 px-5 text-sm font-semibold text-white transition hover:bg-forest-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2">
              Login as Admin <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </Card>

          <Card className="group flex min-h-[260px] flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl sm:p-8">
            <div className="flex items-start justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Truck className="h-6 w-6" /></div>
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Field team</span>
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold text-slate-900">Driver Portal</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">View assigned routes, manage pickups, and report road issues.</p>
            <button onClick={() => onChoose('driver')} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
              Login as Driver <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
          </Card>
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-400">Demo prototype · Simulation only, not a live municipal service.</p>
      </div>
    </main>
  );
}
