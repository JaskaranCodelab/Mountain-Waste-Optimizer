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
  await writeFile(temporary, JSON.stringify({ tracking: [...tracking.values()], stopStatuses, updatedAt: Date.now() }), 'utf8');
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
    return json(response, 200, { ok: true, tracking: tracking.size > 0 });
  }
  if (pathname === '/api/tracking' && request.method === 'GET') {
    for (const [id, item] of tracking) {
      if (Date.now() - (item.updatedAt ?? item.startedAt) > 90_000) tracking.delete(id);
    }
    return json(response, 200, { trucks: [...tracking.values()] });
  }
  if (pathname === '/api/pickup-status' && request.method === 'GET') {
    return json(response, 200, { statuses: stopStatuses });
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
      if (
        typeof trackingKey !== 'string' || typeof truckId !== 'string' || typeof truckName !== 'string' ||
        !Number.isFinite(position?.lat) || !Number.isFinite(position?.lng) ||
        !Number.isFinite(progress) || typeof simulated !== 'boolean' ||
        !Number.isFinite(startedAt) || Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180 ||
        (value.accuracyMeters !== undefined && (!Number.isFinite(value.accuracyMeters) || value.accuracyMeters < 0))
      ) return json(response, 400, { error: 'Invalid truck location update.' });
      tracking.set(trackingKey, { trackingKey, truckId, truckName, position, progress, simulated, startedAt, updatedAt: Date.now(), ...(value.accuracyMeters === undefined ? {} : { accuracyMeters: value.accuracyMeters }) });
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
      if (!['household', 'pine', 'fruit'].includes(value.wasteMode) ||
        typeof value.stopId !== 'string' || !['Pending', 'In Progress', 'Completed'].includes(value.status) ||
        typeof value.note !== 'string') return json(response, 400, { error: 'Invalid pickup status update.' });
      stopStatuses[value.wasteMode][value.stopId] = { id: value.stopId, status: value.status, note: value.note, updatedAt: Date.now() };
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
