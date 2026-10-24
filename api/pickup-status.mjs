const WASTE_MODES = ['household', 'pine', 'fruit'];
const STATUS_KEY_PREFIX = 'himalaya-route:pickup-status:';
const ASSIGNMENT_KEY_PREFIX = 'himalaya-route:driver-assignments:';
const ASSIGNMENT_DETAILS_KEY_PREFIX = 'himalaya-route:driver-assignment-details:';
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
      const assignments = {};
      const assignmentDetails = {};
      await Promise.all(WASTE_MODES.map(async (mode) => {
        const values = await redis(config, 'HGETALL', `${STATUS_KEY_PREFIX}${mode}`);
        const modeStatuses = [];
        for (let index = 0; index < (values || []).length; index += 2) {
          try { modeStatuses.push(JSON.parse(values[index + 1])); } catch { /* ignore malformed entries */ }
        }
        statuses[mode] = modeStatuses;
      }));
      await Promise.all(WASTE_MODES.map(async (mode) => {
        const rawAssignments = await redis(config, 'GET', `${ASSIGNMENT_KEY_PREFIX}${mode}`);
        try { assignments[mode] = rawAssignments ? JSON.parse(rawAssignments) : { driver01: [], driver02: [] }; }
        catch { assignments[mode] = { driver01: [], driver02: [] }; }
        const rawDetails = await redis(config, 'GET', `${ASSIGNMENT_DETAILS_KEY_PREFIX}${mode}`);
        try { assignmentDetails[mode] = rawDetails ? JSON.parse(rawDetails) : { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } }; }
        catch { assignmentDetails[mode] = { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } }; }
      }));
      return reply(response, 200, { statuses, assignments, assignmentDetails });
    }

    if (request.method === 'POST') {
      const value = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      if (value?.action === 'reset-demo') {
        await Promise.all(WASTE_MODES.flatMap((mode) => [
          redis(config, 'DEL', `${STATUS_KEY_PREFIX}${mode}`),
          redis(config, 'DEL', `${ASSIGNMENT_KEY_PREFIX}${mode}`),
          redis(config, 'DEL', `${ASSIGNMENT_DETAILS_KEY_PREFIX}${mode}`),
        ]));
        return reply(response, 200, { ok: true });
      }
      if (value?.action === 'assignments') {
        const validIds = (ids) => Array.isArray(ids) && ids.length <= 100 && ids.every((id) => typeof id === 'string' && id.length <= 80);
        const validDetails = (details) => details && ['driver01', 'driver02'].every((driverId) =>
          (details[driverId]?.area === null || (typeof details[driverId]?.area === 'string' && details[driverId].area.length <= 120)) &&
          (details[driverId]?.truckId === null || ['TRK-01', 'TRK-02'].includes(details[driverId].truckId)));
        if (!WASTE_MODES.includes(value?.wasteMode) || !validIds(value?.assignments?.driver01) || !validIds(value?.assignments?.driver02)) {
          return reply(response, 400, { error: 'Invalid driver stop assignments.' });
        }
        const assignments = { driver01: [...new Set(value.assignments.driver01)], driver02: [...new Set(value.assignments.driver02)] };
        const assignmentDetails = validDetails(value?.assignmentDetails)
          ? value.assignmentDetails
          : { driver01: { area: null, truckId: null }, driver02: { area: null, truckId: null } };
        await redis(config, 'SET', `${ASSIGNMENT_KEY_PREFIX}${value.wasteMode}`, JSON.stringify(assignments));
        await redis(config, 'SET', `${ASSIGNMENT_DETAILS_KEY_PREFIX}${value.wasteMode}`, JSON.stringify(assignmentDetails));
        return reply(response, 200, { ok: true, assignments, assignmentDetails });
      }
      if (!WASTE_MODES.includes(value?.wasteMode) || typeof value?.stopId !== 'string' ||
        !VALID_STATUSES.has(value?.status) || typeof value?.note !== 'string' ||
        (value?.quantityKg !== undefined && (!Number.isFinite(value.quantityKg) || value.quantityKg < 0)) ||
        (value?.emptiedByDriver !== undefined && typeof value.emptiedByDriver !== 'boolean')) {
        return reply(response, 400, { error: 'Invalid pickup status update.' });
      }
      const update = { id: value.stopId, status: value.status, note: value.note, ...(value.quantityKg === undefined ? {} : { quantityKg: value.quantityKg }), ...(value.emptiedByDriver === undefined ? {} : { emptiedByDriver: value.emptiedByDriver }), updatedAt: Date.now() };
      await redis(config, 'HSET', `${STATUS_KEY_PREFIX}${value.wasteMode}`, value.stopId, JSON.stringify(update));
      return reply(response, 200, { ok: true, update });
    }

    return reply(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Shared pickup status API error:', error);
    return reply(response, 502, { error: 'Shared pickup status storage request failed.' });
  }
}
