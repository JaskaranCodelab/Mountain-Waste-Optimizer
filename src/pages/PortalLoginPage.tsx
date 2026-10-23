import { useState, type FormEvent } from 'react';
import { ArrowLeft, Mountain, ShieldCheck, Truck } from 'lucide-react';
import { Button, Card } from '../components/ui';
import type { PortalChoice } from './PortalHomePage';

export type PortalIdentity = { role: 'admin'; id: 'admin' } | { role: 'driver'; id: 'driver01' | 'driver02' };

const DEMO_ACCOUNTS: Record<string, { password: string; identity: PortalIdentity }> = {
  admin: { password: 'admin', identity: { role: 'admin', id: 'admin' } },
  driver01: { password: 'driver123', identity: { role: 'driver', id: 'driver01' } },
  driver02: { password: 'driver123', identity: { role: 'driver', id: 'driver02' } },
};

export function PortalLoginPage({ portal, onBack, onLogin }: {
  portal: PortalChoice;
  onBack: () => void;
  onLogin: (identity: PortalIdentity) => void;
}) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const isAdmin = portal === 'admin';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = DEMO_ACCOUNTS[userId.trim().toLowerCase()];
    if (account && account.identity.role === portal && account.password === password) {
      onLogin(account.identity);
      return;
    }
    setError(isAdmin ? 'Admin ID or password is incorrect.' : 'Driver ID or password is incorrect.');
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <Card className="relative w-full max-w-md p-6 sm:p-8">
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-forest-800"><ArrowLeft className="h-3.5 w-3.5" /> Back to portal selection</button>
        <div className="mb-6 text-center">
          <div className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl ${isAdmin ? 'bg-forest-50 text-forest-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {isAdmin ? <ShieldCheck className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-forest-700"><Mountain className="h-3.5 w-3.5" /> Himalaya Route</div>
          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900">{isAdmin ? 'Admin Login' : 'Driver Login'}</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your {isAdmin ? 'operations dashboard' : 'assigned collection portal'}.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-700">{isAdmin ? 'Admin ID' : 'Driver ID'}
            <input autoComplete="username" value={userId} onChange={(event) => { setUserId(event.target.value); setError(''); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-100" placeholder={isAdmin ? 'Enter admin ID' : 'Enter driver ID'} required />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Password
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-100" placeholder="Enter password" required />
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          <Button type="submit" className="h-12 w-full">Login as {isAdmin ? 'Admin' : 'Driver'}</Button>
        </form>

        <div className="mt-5 rounded-xl bg-slate-50 p-3 text-center text-xs leading-5 text-slate-500">
          {isAdmin ? <>Demo: <b className="text-slate-700">admin / admin</b></> : <>Demo: <b className="text-slate-700">driver01 / driver123</b><br /><b className="text-slate-700">driver02 / driver123</b></>}
        </div>
        <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">Prototype demo authentication only. Credentials are checked in the browser and are not production-secure.</p>
      </Card>
    </main>
  );
}
