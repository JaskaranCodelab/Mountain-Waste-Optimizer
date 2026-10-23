import { useMemo, useState } from 'react';
import {
  FilterX,
  MapPin,
  Mountain,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useApp } from '../store/AppStore';
import type { Priority, Stop, StopStatus, WasteType } from '../types';
import {
  ACCESSIBILITY_META,
  PRIORITY_META,
  WASTE_TYPE_META,
} from '../data/mockStops';
import { formatNumber } from '../lib/geo';
import { ConfirmDialog } from './ConfirmDialog';
import { StopFormModal } from './StopFormModal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  cn,
  inputClass,
  selectClass,
  type BadgeTone,
} from './ui';

type SortKey =
  | 'route'
  | 'quantity-desc'
  | 'quantity-asc'
  | 'priority-desc'
  | 'priority-asc';

function wasteTone(type: WasteType): BadgeTone {
  if (type === 'pine') {
    return 'amber';
  }
  if (type === 'fruit') {
    return 'red';
  }
  return 'forest';
}

function priorityTone(priority: Priority): BadgeTone {
  if (priority === 'high') {
    return 'red';
  }
  if (priority === 'medium') {
    return 'amber';
  }
  return 'teal';
}

function statusTone(status: StopStatus): BadgeTone {
  if (status === 'Completed') {
    return 'green';
  }
  if (status === 'In Progress') {
    return 'amber';
  }
  return 'slate';
}

export function PickupStopsTable() {
  const {
    stops,
    wasteMode,
    activePlan,
    selectedStopId,
    selectStop,
    removeStop,
    setView,
  } = useApp();
  const [search, setSearch] = useState('');
  const [wasteFilter, setWasteFilter] = useState<'all' | WasteType>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StopStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('route');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Stop | null>(null);

  const routeIndex = useMemo(() => {
    const map = new Map<string, number>();
    const order = activePlan?.stopOrder ?? stops.map((stop) => stop.id);
    order.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [activePlan, stops]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = stops.filter((stop) => {
      const matchesQuery =
        !query ||
        stop.name.toLowerCase().includes(query) ||
        stop.area.toLowerCase().includes(query) ||
        stop.id.toLowerCase().includes(query);
      const matchesWaste =
        wasteFilter === 'all' || stop.wasteType === wasteFilter;
      const matchesPriority =
        priorityFilter === 'all' || stop.priority === priorityFilter;
      const matchesStatus =
        statusFilter === 'all' || stop.status === statusFilter;
      return matchesQuery && matchesWaste && matchesPriority && matchesStatus;
    });

    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'quantity-desc':
          return b.quantityKg - a.quantityKg;
        case 'quantity-asc':
          return a.quantityKg - b.quantityKg;
        case 'priority-desc':
          return PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank;
        case 'priority-asc':
          return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
        default:
          return (routeIndex.get(a.id) ?? 999) - (routeIndex.get(b.id) ?? 999);
      }
    });
  }, [
    stops,
    search,
    wasteFilter,
    priorityFilter,
    statusFilter,
    sortKey,
    routeIndex,
  ]);

  const hasFilters =
    search.trim() !== '' ||
    wasteFilter !== 'all' ||
    priorityFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortKey !== 'route';

  const clearFilters = () => {
    setSearch('');
    setWasteFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setSortKey('route');
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (stop: Stop) => {
    setEditing(stop);
    setModalOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="space-y-4 border-b border-slate-100 p-4">
          <SectionHeader
            eyebrow={`${WASTE_TYPE_META[wasteMode].label} profile`}
            title="Pickup stop management"
            subtitle="Exactly 10 seeded demo stops; add, edit or delete to see route metrics recalculate."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add simulated stop
              </Button>
            }
          />

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className={cn(inputClass, 'pl-9')}
                placeholder="Search name, area or ID…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto">
              <select
                className={cn(selectClass, 'xl:w-[145px]')}
                value={wasteFilter}
                onChange={(event) =>
                  setWasteFilter(event.target.value as 'all' | WasteType)
                }
                aria-label="Filter by waste type"
              >
                <option value="all">All waste types</option>
                {(Object.keys(WASTE_TYPE_META) as WasteType[]).map((type) => (
                  <option key={type} value={type}>
                    {WASTE_TYPE_META[type].shortLabel}
                  </option>
                ))}
              </select>
              <select
                className={cn(selectClass, 'xl:w-[130px]')}
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as 'all' | Priority)
                }
                aria-label="Filter by priority"
              >
                <option value="all">All priorities</option>
                {(Object.keys(PRIORITY_META) as Priority[]).map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_META[priority].label}
                  </option>
                ))}
              </select>
              <select
                className={cn(selectClass, 'xl:w-[130px]')}
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'all' | StopStatus)
                }
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              <select
                className={cn(selectClass, 'xl:w-[150px]')}
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                aria-label="Sort stops"
              >
                <option value="route">Sort: route order</option>
                <option value="quantity-desc">Quantity: high to low</option>
                <option value="quantity-asc">Quantity: low to high</option>
                <option value="priority-desc">Priority: high to low</option>
                <option value="priority-asc">Priority: low to high</option>
              </select>
            </div>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <FilterX className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-4 py-2.5">Stop #</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5">Waste type</th>
                <th className="px-4 py-2.5">Quantity</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">Accessibility</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((stop) => {
                const selected = selectedStopId === stop.id;
                return (
                  <tr
                    key={stop.id}
                    onClick={() => selectStop(stop.id)}
                    className={cn(
                      'cursor-pointer text-xs transition',
                      selected ? 'bg-forest-50/70' : 'hover:bg-slate-50',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold',
                          selected
                            ? 'bg-forest-700 text-white'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {routeIndex.get(stop.id) ?? '—'}
                      </span>
                    </td>
                    <td className="max-w-[230px] px-4 py-2.5">
                      <p className="truncate font-semibold text-slate-800">
                        {stop.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">
                        {stop.area}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={wasteTone(stop.wasteType)}>
                        {WASTE_TYPE_META[stop.wasteType].shortLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-700">
                      {formatNumber(stop.quantityKg)} kg
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={priorityTone(stop.priority)}>
                        {PRIORITY_META[stop.priority].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-medium',
                          stop.accessibility === 'easy'
                            ? 'text-slate-500'
                            : stop.accessibility === 'restricted'
                              ? 'text-red-700'
                              : 'text-amber-700',
                        )}
                      >
                        <Mountain className="h-3 w-3" />
                        {ACCESSIBILITY_META[stop.accessibility].label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={statusTone(stop.status)}>
                        {stop.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectStop(stop.id);
                            setView('map');
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-forest-50 hover:text-forest-700"
                          title="Show on map"
                          aria-label={`Show ${stop.name} on map`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(stop);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-sky-50 hover:text-sky-700"
                          title="Edit stop"
                          aria-label={`Edit ${stop.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(stop);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete stop"
                          aria-label={`Delete ${stop.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<PackagePlus className="h-4 w-4" />}
              title={stops.length === 0 ? 'No pickup stops' : 'No matches'}
              description={
                stops.length === 0
                  ? 'Add a simulated stop to restart the route optimizer.'
                  : 'Adjust the search or filters to see stops again.'
              }
              action={
                stops.length === 0 ? (
                  <Button size="sm" onClick={openAdd}>
                    <Plus className="h-3.5 w-3.5" />
                    Add simulated stop
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <FilterX className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                )
              }
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[10px] text-slate-400">
          <span>
            Showing {filtered.length} of {stops.length} simulated stops • route
            recalculates automatically after edits
          </span>
          <span className="font-medium text-slate-500">
            Total scheduled: {formatNumber(
              stops.reduce((total, stop) => total + stop.quantityKg, 0),
            )}{' '}
            kg
          </span>
        </div>
      </Card>

      <StopFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete pickup stop?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be removed from the ${WASTE_TYPE_META[wasteMode].label} demo dataset.`
            : ''
        }
        confirmLabel="Delete stop"
        onConfirm={() => {
          if (deleteTarget) {
            removeStop(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
