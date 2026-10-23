import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = resolve(root, 'runtime', 'driver-tracking.json');
const port = Number(process.env.TRACKING_PORT || 8787);
const clients = new Set();
let tracking = null;

try {
  const saved = JSON.parse(await readFile(stateFile, 'utf8'));
  if (Date.now() - saved.updatedAt < 30_000) tracking = saved.tracking;
} catch {
  tracking = null;
}

function sendEvent(response) {
  response.write(`data: ${JSON.stringify(tracking)}\n\n`);
}

function broadcast() {
  for (const client of clients) sendEvent(client);
}

async function persist() {
  await mkdir(dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.tmp`;
  await writeFile(temporary, JSON.stringify({ tracking, updatedAt: Date.now() }), 'utf8');
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
    return json(response, 200, { ok: true, tracking: tracking !== null });
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
      const { truckId, truckName, position, progress, simulated, startedAt } = value;
      if (
        typeof truckId !== 'string' || typeof truckName !== 'string' ||
        !Number.isFinite(position?.lat) || !Number.isFinite(position?.lng) ||
        !Number.isFinite(progress) || typeof simulated !== 'boolean' ||
        !Number.isFinite(startedAt) || Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180 ||
        (value.accuracyMeters !== undefined && (!Number.isFinite(value.accuracyMeters) || value.accuracyMeters < 0))
      ) return json(response, 400, { error: 'Invalid truck location update.' });
      tracking = { truckId, truckName, position, progress, simulated, startedAt, updatedAt: Date.now() };
      await persist();
      broadcast();
      return json(response, 200, { ok: true });
    } catch {
      return json(response, 400, { error: 'Could not read tracking update.' });
    }
  }
  if (pathname === '/api/tracking' && request.method === 'DELETE') {
    tracking = null;
    await persist();
    broadcast();
    return json(response, 200, { ok: true });
  }
  return json(response, 404, { error: 'Not found.' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Driver tracking API listening on http://0.0.0.0:${port}`);
});
