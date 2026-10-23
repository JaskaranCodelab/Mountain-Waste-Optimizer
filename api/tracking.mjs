const ACTIVE_TRUCKS_KEY = 'himalaya-route:tracking:active';
const TRUCK_KEY_PREFIX = 'himalaya-route:tracking:truck:';
const LOCATION_TTL_SECONDS = 90;

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(config, ...command) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(result.error || `Redis request failed (${response.status}).`);
  }
  return result.result;
}

function isValidTracking(value) {
  return value &&
    typeof value.trackingKey === 'string' && value.trackingKey.length <= 100 &&
    typeof value.truckId === 'string' && value.truckId.length <= 40 &&
    typeof value.truckName === 'string' && value.truckName.length <= 120 &&
    Number.isFinite(value.position?.lat) && Math.abs(value.position.lat) <= 90 &&
    Number.isFinite(value.position?.lng) && Math.abs(value.position.lng) <= 180 &&
    Number.isFinite(value.progress) && value.progress >= 0 && value.progress <= 1 &&
    typeof value.simulated === 'boolean' && Number.isFinite(value.startedAt) &&
    (value.accuracyMeters === undefined ||
      (Number.isFinite(value.accuracyMeters) && value.accuracyMeters >= 0));
}

function json(response, status, data) {
  response.status(status).setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return response.json(data);
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') return response.status(204).end();

  const config = redisConfig();
  if (!config) {
    return json(response, 503, {
      error: 'Shared tracking storage is not configured. Connect Upstash Redis to this Vercel project.',
    });
  }

  try {
    if (request.method === 'GET') {
      const ids = await redis(config, 'SMEMBERS', ACTIVE_TRUCKS_KEY);
      const trucks = await Promise.all((ids || []).map(async (id) => {
        const value = await redis(config, 'GET', `${TRUCK_KEY_PREFIX}${id}`);
        if (!value) {
          await redis(config, 'SREM', ACTIVE_TRUCKS_KEY, id);
          return null;
        }
        try { return JSON.parse(value); } catch { return null; }
      }));
      return json(response, 200, { trucks: trucks.filter(Boolean) });
    }

    if (request.method === 'POST') {
      const value = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      if (!isValidTracking(value)) return json(response, 400, { error: 'Invalid truck location update.' });
      const tracking = { ...value, updatedAt: Date.now() };
      const id = tracking.trackingKey;
      await redis(config, 'SET', `${TRUCK_KEY_PREFIX}${id}`, JSON.stringify(tracking), 'EX', LOCATION_TTL_SECONDS);
      await redis(config, 'SADD', ACTIVE_TRUCKS_KEY, id);
      return json(response, 200, { ok: true, tracking });
    }

    if (request.method === 'DELETE') {
      const id = typeof request.query?.id === 'string' ? request.query.id : '';
      if (!id) return json(response, 400, { error: 'A tracking id is required.' });
      await redis(config, 'DEL', `${TRUCK_KEY_PREFIX}${id}`);
      await redis(config, 'SREM', ACTIVE_TRUCKS_KEY, id);
      return json(response, 200, { ok: true });
    }

    return json(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Shared tracking API error:', error);
    return json(response, 502, { error: 'Shared tracking storage request failed.' });
  }
}
