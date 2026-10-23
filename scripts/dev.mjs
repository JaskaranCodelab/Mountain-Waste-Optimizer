import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const processes = [
  spawn(node, ['server/tracking-server.mjs'], { cwd: root, stdio: 'inherit' }),
  spawn(node, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { cwd: root, stdio: 'inherit' }),
];

function shutdown() {
  for (const child of processes) child.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const child of processes) child.on('exit', (code) => {
  if (code && code !== 0) shutdown();
});
