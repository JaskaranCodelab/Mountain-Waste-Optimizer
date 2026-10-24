import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../store/AppStore';
import { cn } from './ui';

export function Toast() {
  const { notice, dismissNotice } = useApp();
  if (!notice) {
    return null;
  }
  const Icon =
    notice.tone === 'success'
      ? CheckCircle2
      : notice.tone === 'error'
        ? AlertTriangle
        : Info;
  return (
    <div className="fixed bottom-4 right-4 z-[1200] max-w-sm">
      <div
        className={cn(
          'glass-toast toast-enter flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-float',
          notice.tone === 'success'
            ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
            : notice.tone === 'error'
              ? 'border-red-200/80 bg-red-50/85 text-red-700'
              : 'border-slate-200/80 bg-white/75 text-slate-700',
        )}
        role="status"
      >
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            notice.tone === 'success'
              ? 'text-emerald-600'
              : notice.tone === 'error'
                ? 'text-red-500'
                : 'text-sky-600',
          )}
        />
        <p className="flex-1 leading-5">{notice.message}</p>
        <button
          type="button"
          onClick={dismissNotice}
          className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
