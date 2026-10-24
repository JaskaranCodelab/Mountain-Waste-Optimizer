import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = resolve(root, 'runtime', 'driver-tracking.json');
const port = Number(process.env.TRACKING_PORT || 8787);
const clients = new Set();
let tracking = new Map();
let stopStatuses = { household: {}, pine: {}, fruit: {} };
let driverAssignments = { household: { driver01: [], driver02: [] }, pine: { driver01: [], driver02: [] }, fruit: { driver01: [], driver02: [] } };
let driverAssignmentDetails = { household: { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } }, pine: { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } }, fruit: { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } } };

try {
  const saved = JSON.parse(await readFile(stateFile, 'utf8'));
  if (Array.isArray(saved.tracking)) {
    tracking = new Map(saved.tracking.map((item) => [item.trackingKey ?? item.truckId, item]));
  } else if (saved.tracking && Date.now() - saved.updatedAt < 30_000) {
    const item = saved.tracking;
    tracking = new Map([[item.trackingKey ?? item.truckId, item]]);
  }
  if (saved.stopStatuses && typeof saved.stopStatuses === 'object') {
    stopStatuses = { ...stopStatuses, ...saved.stopStatuses };
  }
  if (saved.driverAssignments && typeof saved.driverAssignments === 'object') driverAssignments = { ...driverAssignments, ...saved.driverAssignments };
  if (saved.driverAssignmentDetails && typeof saved.driverAssignmentDetails === 'object') driverAssignmentDetails = { ...driverAssignmentDetails, ...saved.driverAssignmentDetails };
} catch {
  tracking = new Map();
}

function sendEvent(response) {
  response.write(`data: ${JSON.stringify([...tracking.values()])}\n\n`);
}

function broadcast() {
  for (const client of clients) sendEvent(client);
}

async function persist() {
  await mkdir(dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.tmp`;
  await writeFile(temporary, JSON.stringify({ tracking: [...tracking.values()], stopStatuses, driverAssignments, driverAssignmentDetails, updatedAt: Date.now() }), 'utf8');
  await rename(temporary, stateFile);
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    return response.end();
  }
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/api/health' && request.method === 'GET') {
    return json(response, 200, { ok: true, service: 'himalaya-tracking', apiVersion: 3, tracking: tracking.size > 0 });
  }
  if (pathname === '/api/tracking' && request.method === 'GET') {
    for (const [id, item] of tracking) {
      if (Date.now() - (item.updatedAt ?? item.startedAt) > 90_000) tracking.delete(id);
    }
    return json(response, 200, { trucks: [...tracking.values()] });
  }
  if (pathname === '/api/pickup-status' && request.method === 'GET') {
    return json(response, 200, { statuses: stopStatuses, assignments: driverAssignments, assignmentDetails: driverAssignmentDetails });
  }
  if (pathname === '/api/tracking/events' && request.method === 'GET') {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.write(': tracking connection ready\n\n');
    clients.add(response);
    sendEvent(response);
    request.on('close', () => clients.delete(response));
    return;
  }
  if (pathname === '/api/tracking' && request.method === 'POST') {
    let raw = '';
    request.setEncoding('utf8');
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 16_384) return json(response, 413, { error: 'Tracking update is too large.' });
    }
    try {
      const value = JSON.parse(raw);
      const { trackingKey, truckId, truckName, position, progress, simulated, startedAt } = value;
      const routeGeometry = value.routeGeometry;
      if (
        typeof trackingKey !== 'string' || typeof truckId !== 'string' || typeof truckName !== 'string' ||
        !Number.isFinite(position?.lat) || !Number.isFinite(position?.lng) ||
        !Number.isFinite(progress) || typeof simulated !== 'boolean' ||
        !Number.isFinite(startedAt) || Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180 ||
        (value.accuracyMeters !== undefined && (!Number.isFinite(value.accuracyMeters) || value.accuracyMeters < 0))
        || (value.sequence !== undefined && (!Number.isInteger(value.sequence) || value.sequence < 0))
        || (routeGeometry !== undefined && (!Array.isArray(routeGeometry) || routeGeometry.length > 200 || routeGeometry.some((point) =>
          !Number.isFinite(point?.lat) || Math.abs(point.lat) > 90 || !Number.isFinite(point?.lng) || Math.abs(point.lng) > 180)))
      ) return json(response, 400, { error: 'Invalid truck location update.' });
      const existing = tracking.get(trackingKey);
      if (existing && Number.isInteger(existing.sequence) && Number.isInteger(value.sequence) && value.sequence < existing.sequence) {
        return json(response, 200, { ok: true, stale: true });
      }
      const existingTruckSession = [...tracking.values()].find((item) => item.truckId === truckId && item.trackingKey !== trackingKey);
      if (existingTruckSession && (existingTruckSession.startedAt ?? 0) > startedAt) {
        return json(response, 200, { ok: true, stale: true });
      }
      for (const [oldKey, oldSession] of tracking) {
        if (oldSession.truckId === truckId && oldKey !== trackingKey) tracking.delete(oldKey);
      }
      tracking.set(trackingKey, {
        ...(existing ?? {}),
        ...value,
        routeGeometry: value.routeGeometry ?? existing?.routeGeometry,
        updatedAt: Date.now(),
      });
      await persist();
      broadcast();
      return json(response, 200, { ok: true });
    } catch {
      return json(response, 400, { error: 'Could not read tracking update.' });
    }
  }
  if (pathname === '/api/pickup-status' && request.method === 'POST') {
    let raw = '';
    request.setEncoding('utf8');
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 16_384) return json(response, 413, { error: 'Pickup status update is too large.' });
    }
    try {
      const value = JSON.parse(raw);
      if (value.action === 'reset-demo') {
        stopStatuses = { household: {}, pine: {}, fruit: {} };
        driverAssignments = { household: { driver01: [], driver02: [] }, pine: { driver01: [], driver02: [] }, fruit: { driver01: [], driver02: [] } };
        driverAssignmentDetails = { household: { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } }, pine: { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } }, fruit: { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } } };
        await persist();
        return json(response, 200, { ok: true });
      }
      if (value.action === 'assignments') {
        const idsOkay = (ids) => Array.isArray(ids) && ids.length <= 100 && ids.every((id) => typeof id === 'string');
        if (!['household', 'pine', 'fruit'].includes(value.wasteMode) || !idsOkay(value.assignments?.driver01) || !idsOkay(value.assignments?.driver02)) return json(response, 400, { error: 'Invalid driver stop assignments.' });
        const details = value.assignmentDetails;
        if (details && !['driver01', 'driver02'].every((id) =>
          (details[id]?.area === null || typeof details[id]?.area === 'string') &&
          (details[id]?.truckId === null || ['TRK-01', 'TRK-02'].includes(details[id]?.truckId)))) return json(response, 400, { error: 'Invalid driver truck or area assignment.' });
        driverAssignments[value.wasteMode] = { driver01: [...new Set(value.assignments.driver01)], driver02: [...new Set(value.assignments.driver02)] };
        driverAssignmentDetails[value.wasteMode] = details ?? driverAssignmentDetails[value.wasteMode];
        await persist();
        return json(response, 200, { ok: true, assignments: driverAssignments[value.wasteMode], assignmentDetails: driverAssignmentDetails[value.wasteMode] });
      }
      if (!['household', 'pine', 'fruit'].includes(value.wasteMode) ||
        typeof value.stopId !== 'string' || !['Pending', 'In Progress', 'Completed'].includes(value.status) ||
        typeof value.note !== 'string' ||
        (value.quantityKg !== undefined && (!Number.isFinite(value.quantityKg) || value.quantityKg < 0)) ||
        (value.emptiedByDriver !== undefined && typeof value.emptiedByDriver !== 'boolean')) return json(response, 400, { error: 'Invalid pickup status update.' });
      stopStatuses[value.wasteMode][value.stopId] = { id: value.stopId, status: value.status, note: value.note, ...(value.quantityKg === undefined ? {} : { quantityKg: value.quantityKg }), ...(value.emptiedByDriver === undefined ? {} : { emptiedByDriver: value.emptiedByDriver }), updatedAt: Date.now() };
      await persist();
      return json(response, 200, { ok: true });
    } catch {
      return json(response, 400, { error: 'Could not read pickup status update.' });
    }
  }
  if (pathname === '/api/tracking' && request.method === 'DELETE') {
    const id = new URL(request.url ?? '/', 'http://localhost').searchParams.get('id');
    if (!id) return json(response, 400, { error: 'A tracking id is required.' });
    tracking.delete(id);
    await persist();
    broadcast();
    return json(response, 200, { ok: true });
  }
  return json(response, 404, { error: 'Not found.' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Driver tracking API listening on http://0.0.0.0:${port}`);
});
