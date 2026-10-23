import { useEffect, useState } from 'react';
import { AlertTriangle, MapPinned, Plus, Save } from 'lucide-react';
import { useApp } from '../store/AppStore';
import type {
  Accessibility,
  Priority,
  Stop,
  StopStatus,
  WasteType,
} from '../types';
import {
  ACCESSIBILITY_META,
  PRIORITY_META,
  WASTE_TYPE_META,
} from '../data/mockStops';
import {
  Button,
  Field,
  InfoNote,
  Modal,
  inputClass,
  selectClass,
} from './ui';

interface FormState {
  name: string;
  area: string;
  lat: string;
  lng: string;
  wasteType: WasteType;
  quantityKg: string;
  priority: Priority;
  status: StopStatus;
  serviceTimeMin: string;
  accessibility: Accessibility;
  note: string;
}

function emptyForm(mode: WasteType): FormState {
  return {
    name: '',
    area: '',
    lat: '30.25',
    lng: '78.9',
    wasteType: mode,
    quantityKg: '80',
    priority: 'medium',
    status: 'Pending',
    serviceTimeMin: '15',
    accessibility: 'moderate',
    note: 'Simulated demo pickup',
  };
}

function toForm(stop: Stop): FormState {
  return {
    name: stop.name,
    area: stop.area,
    lat: String(stop.lat),
    lng: String(stop.lng),
    wasteType: stop.wasteType,
    quantityKg: String(stop.quantityKg),
    priority: stop.priority,
    status: stop.status,
    serviceTimeMin: String(stop.serviceTimeMin),
    accessibility: stop.accessibility,
    note: stop.note,
  };
}

export function StopFormModal({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: Stop | null;
  onClose: () => void;
}) {
  const { wasteMode, upsertStop } = useApp();
  const [form, setForm] = useState<FormState>(() => emptyForm(wasteMode));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setForm(editing ? toForm(editing) : emptyForm(wasteMode));
  }, [open, editing, wasteMode]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const area = form.area.trim();
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const quantityKg = Number(form.quantityKg);
    const serviceTimeMin = Number(form.serviceTimeMin);

    if (!name) {
      setError('Enter a stop name.');
      return;
    }
    if (!area) {
      setError('Enter the town or area label.');
      return;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('Longitude must be a valid number between -180 and 180.');
      return;
    }
    if (!Number.isFinite(quantityKg) || quantityKg < 1 || quantityKg > 5000) {
      setError('Quantity must be between 1 and 5,000 kg.');
      return;
    }
    if (
      !Number.isFinite(serviceTimeMin) ||
      serviceTimeMin < 1 ||
      serviceTimeMin > 240
    ) {
      setError('Service time must be between 1 and 240 minutes.');
      return;
    }

    const stop: Stop = {
      id: editing?.id ?? `stop-${Date.now().toString(36)}`,
      name,
      area,
      lat,
      lng,
      wasteType: form.wasteType,
      quantityKg,
      priority: form.priority,
      status: form.status,
      serviceTimeMin,
      accessibility: form.accessibility,
      note: form.note.trim() || 'Simulated demo pickup',
    };
    upsertStop(stop);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit pickup stop' : 'Add simulated pickup stop'}
      description="Changes are saved to LocalStorage and trigger a route recalculation. This is demo data, not a live municipal record."
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="stop-form">
            {editing ? (
              <>
                <Save className="h-3.5 w-3.5" />
                Save changes
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add stop
              </>
            )}
          </Button>
        </>
      }
    >
      <form id="stop-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stop name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="e.g. Almora Market Yard"
              autoFocus
            />
          </Field>
          <Field label="Town / area">
            <input
              className={inputClass}
              value={form.area}
              onChange={(event) => update('area', event.target.value)}
              placeholder="e.g. Almora, Kumaon"
            />
          </Field>
          <Field
            label="Latitude"
            hint="Uttarakhand roughly spans 28.7°N to 31.5°N."
          >
            <input
              className={inputClass}
              type="number"
              step="0.0001"
              value={form.lat}
              onChange={(event) => update('lat', event.target.value)}
            />
          </Field>
          <Field
            label="Longitude"
            hint="Uttarakhand roughly spans 77.5°E to 81.1°E."
          >
            <input
              className={inputClass}
              type="number"
              step="0.0001"
              value={form.lng}
              onChange={(event) => update('lng', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Waste type">
            <select
              className={selectClass}
              value={form.wasteType}
              onChange={(event) =>
                update('wasteType', event.target.value as WasteType)
              }
            >
              {(Object.keys(WASTE_TYPE_META) as WasteType[]).map((type) => (
                <option key={type} value={type}>
                  {WASTE_TYPE_META[type].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity (kg)">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={5000}
              step={1}
              value={form.quantityKg}
              onChange={(event) => update('quantityKg', event.target.value)}
            />
          </Field>
          <Field label="Service time (min)">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={240}
              step={1}
              value={form.serviceTimeMin}
              onChange={(event) =>
                update('serviceTimeMin', event.target.value)
              }
            />
          </Field>
          <Field label="Priority">
            <select
              className={selectClass}
              value={form.priority}
              onChange={(event) =>
                update('priority', event.target.value as Priority)
              }
            >
              {(Object.keys(PRIORITY_META) as Priority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_META[priority].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Accessibility">
            <select
              className={selectClass}
              value={form.accessibility}
              onChange={(event) =>
                update('accessibility', event.target.value as Accessibility)
              }
            >
              {(Object.keys(ACCESSIBILITY_META) as Accessibility[]).map(
                (accessibility) => (
                  <option key={accessibility} value={accessibility}>
                    {ACCESSIBILITY_META[accessibility].label}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Collection status">
            <select
              className={selectClass}
              value={form.status}
              onChange={(event) =>
                update('status', event.target.value as StopStatus)
              }
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </Field>
        </div>

        <Field label="Demo note" hint="Shown in the map popup for context.">
          <textarea
            className="min-h-[70px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-forest-400 focus:ring-2 focus:ring-forest-100"
            value={form.note}
            onChange={(event) => update('note', event.target.value)}
            placeholder="Simulated demo pickup"
          />
        </Field>

        {error ? (
          <InfoNote tone="red" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
            {error}
          </InfoNote>
        ) : (
          <InfoNote tone="blue" icon={<MapPinned className="h-3.5 w-3.5" />}>
            New coordinates are routed through the OpenStreetMap road network
            when available. If the routing service is unavailable, a
            clearly-labelled simulated route is used instead.
          </InfoNote>
        )}
      </form>
    </Modal>
  );
}
