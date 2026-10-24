import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './store/AppStore';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Toast } from './components/Toast';
import { OverviewPage } from './pages/OverviewPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { RoutePlannerPage } from './pages/RoutePlannerPage';
import { RouteComparisonPage } from './pages/RouteComparisonPage';
import { PickupStopsPage } from './pages/PickupStopsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DriverPortal } from './pages/DriverPortal';
import { PortalHomePage, type PortalChoice } from './pages/PortalHomePage';
import { PortalLoginPage, type PortalIdentity } from './pages/PortalLoginPage';

function CurrentPage() {
  const { view } = useApp();
  switch (view) {
    case 'map':
      return <LiveMapPage />;
    case 'planner':
      return <RoutePlannerPage />;
    case 'compare':
      return <RouteComparisonPage />;
    case 'stops':
      return <PickupStopsPage />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'overview':
    default:
      return <OverviewPage />;
  }
}

function AppShell() {
  const { view, setView } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [screen, setScreen] = useState<'home' | 'admin-login' | 'driver-login' | 'admin' | 'driver'>('home');
  const [identity, setIdentity] = useState<PortalIdentity | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSidebarOpen(false);
  }, [view, screen]);

  function choosePortal(portal: PortalChoice) {
    setScreen(portal === 'admin' ? 'admin-login' : 'driver-login');
  }

  function login(nextIdentity: PortalIdentity) {
    setIdentity(nextIdentity);
    if (nextIdentity.role === 'admin') {
      setView('overview');
      setScreen('admin');
    } else {
      setScreen('driver');
    }
  }

  function logout() {
    setIdentity(null);
    setView('overview');
    setScreen('home');
  }

  if (screen === 'home') return <PortalHomePage onChoose={choosePortal} />;
  if (screen === 'admin-login' || screen === 'driver-login') {
    return <PortalLoginPage portal={screen === 'admin-login' ? 'admin' : 'driver'} onBack={() => setScreen('home')} onLogin={login} />;
  }
  if (screen === 'driver' && identity?.role === 'driver') {
    return <><DriverPortal driverId={identity.id} onLogout={logout} /><Toast /></>;
  }
  if (screen !== 'admin' || identity?.role !== 'admin') {
    return <PortalHomePage onChoose={choosePortal} />;
  }

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="flex min-h-screen flex-col lg:pl-[272px]">
        <Topbar onMenu={() => setSidebarOpen(true)} onLogout={logout} />
        <main className="flex-1 px-4 py-5 sm:px-6 xl:px-8">
          <div className="mx-auto w-full max-w-[1500px]">
            <CurrentPage />
          </div>
        </main>
        <footer className="mt-2 border-t border-white/60 bg-white/35 px-4 py-4 backdrop-blur-xl sm:px-6 xl:px-8">
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-1.5 text-[10px] leading-4 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-semibold text-slate-500">
                Himalaya Route
              </span>{' '}
              • AI mountain waste collection optimizer demo • Simulation only,
              not a live municipal service.
            </p>
            <p>
              Map data © OpenStreetMap contributors • public road routing when
              available • Costs are configurable estimates.
            </p>
          </div>
        </footer>
      </div>

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
