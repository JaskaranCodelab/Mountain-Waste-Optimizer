import {
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Timer,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import { Button, cn } from './ui';

export function RouteControls({ compact = false }: { compact?: boolean }) {
  const {
    activePlan,
    simulationStatus,
    progress,
    stops,
    startRoute,
    pauseRoute,
    resumeRoute,
    advanceToNextStop,
    resetSimulation,
    optimizeRoute,
    fitRoute,
    fleet,
    routing,
  } = useApp();

  const isRunning = simulationStatus === 'running';
  const isPaused = simulationStatus === 'paused';
  const isComplete = simulationStatus === 'complete' || progress >= 1;
  const hasPlan = Boolean(activePlan);

  return (
    <div className={cn('space-y-3', compact ? '' : 'pt-1')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          variant="primary"
          size={compact ? 'sm' : 'md'}
          onClick={startRoute}
          disabled={!hasPlan || isRunning || isPaused || routing.loading}
          title="Start the two simulated trucks"
          className="justify-start"
        >
          <Play className="h-3.5 w-3.5" />
          {simulationStatus === 'running' ? 'Running' : 'Start fleet'}
        </Button>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          onClick={pauseRoute}
          disabled={!isRunning}
          title="Pause both simulated trucks"
          className="justify-start"
        >
          <Pause className="h-3.5 w-3.5" />
          Pause fleet
        </Button>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          onClick={resumeRoute}
          disabled={!isPaused || !hasPlan}
          title="Resume both simulated trucks"
          className="justify-start"
        >
          <Play className="h-3.5 w-3.5" />
          Resume fleet
        </Button>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          onClick={advanceToNextStop}
          disabled={!hasPlan || isComplete}
          title="Advance the truck to the next pickup stop"
          className="justify-start"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Next Stop
        </Button>
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          onClick={resetSimulation}
          disabled={!hasPlan}
          title="Reset both simulated trucks to the depot"
          className="justify-start"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          variant="secondary"
          size={compact ? 'sm' : 'md'}
          onClick={optimizeRoute}
          disabled={stops.length === 0}
          title="Recalculate the capacity-aware optimized sequence"
          className="justify-start"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Optimize Route
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Timer className="h-3 w-3" />
          Live fleet • {fleet.length} trucks
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fitRoute}
          disabled={!hasPlan}
          title="Fit the full route in the map viewport"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Fit Route
        </Button>
      </div>
    </div>
  );
}
