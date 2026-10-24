import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const processes = [];
let shuttingDown = false;

async function trackingServerStatus(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(700) });
    if (!response.ok) return 'occupied';
    const health = await response.json();
    return health.service === 'himalaya-tracking' && health.apiVersion === 3 ? 'current' : 'occupied';
  } catch {
    return 'available';
  }
}

function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', env });
  processes.push(child);
  child.on('error', (error) => {
    console.error(`Could not start ${args[0]}:`, error.message);
    shutdown('SIGTERM', 1);
  });
  child.on('exit', (code) => {
    if (!shuttingDown) shutdown('SIGTERM', code ?? 1);
  });
}

function shutdown(signal = 'SIGTERM', exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const child of processes) child.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGTERM', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

let trackingPort = 8787;
let trackingStatus = await trackingServerStatus(trackingPort);
if (trackingStatus === 'occupied') {
  trackingPort = 8788;
  trackingStatus = await trackingServerStatus(trackingPort);
}
if (trackingStatus === 'occupied') {
  console.error('Tracking API ports 8787 and 8788 are occupied by incompatible servers. Stop one and retry npm run dev.');
  process.exitCode = 1;
} else {
  const env = { ...process.env, TRACKING_PORT: String(trackingPort) };
  if (trackingStatus === 'current') {
    console.log(`Reusing tracking API at http://127.0.0.1:${trackingPort}`);
  } else {
    start(node, ['server/tracking-server.mjs'], env);
  }
  start(node, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], env);
}
