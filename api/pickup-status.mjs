const WASTE_MODES = ['household', 'pine', 'fruit'];
const STATUS_KEY_PREFIX = 'himalaya-route:pickup-status:';
const VALID_STATUSES = new Set(['Pending', 'In Progress', 'Completed']);

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function redis(config, ...command) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || `Redis request failed (${response.status}).`);
  return result.result;
}

function reply(response, status, body) {
  response.status(status).setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return response.json(body);
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') return response.status(204).end();
  const config = redisConfig();
  if (!config) return reply(response, 503, { error: 'Shared tracking storage is not configured.' });

  try {
    if (request.method === 'GET') {
      const statuses = {};
      await Promise.all(WASTE_MODES.map(async (mode) => {
        const values = await redis(config, 'HGETALL', `${STATUS_KEY_PREFIX}${mode}`);
        const modeStatuses = [];
        for (let index = 0; index < (values || []).length; index += 2) {
          try { modeStatuses.push(JSON.parse(values[index + 1])); } catch { /* ignore malformed entries */ }
        }
        statuses[mode] = modeStatuses;
      }));
      return reply(response, 200, { statuses });
    }

    if (request.method === 'POST') {
      const value = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      if (!WASTE_MODES.includes(value?.wasteMode) || typeof value?.stopId !== 'string' ||
        !VALID_STATUSES.has(value?.status) || typeof value?.note !== 'string') {
        return reply(response, 400, { error: 'Invalid pickup status update.' });
      }
      const update = { id: value.stopId, status: value.status, note: value.note, updatedAt: Date.now() };
      await redis(config, 'HSET', `${STATUS_KEY_PREFIX}${value.wasteMode}`, value.stopId, JSON.stringify(update));
      return reply(response, 200, { ok: true, update });
    }

    return reply(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Shared pickup status API error:', error);
    return reply(response, 502, { error: 'Shared pickup status storage request failed.' });
  }
}
