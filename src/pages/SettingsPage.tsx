import { Settings2 } from 'lucide-react';
import { SettingsPanel } from '../components/SettingsPanel';
import { SectionHeader } from '../components/ui';

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Settings"
        title="Route assumptions & demo controls"
        subtitle="Configure routing, cost assumptions, simulation speed, location permission and demo data."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm">
            <Settings2 className="h-3 w-3" />
            Browser-local configuration
          </span>
        }
      />
      <SettingsPanel />
    </div>
  );
}
