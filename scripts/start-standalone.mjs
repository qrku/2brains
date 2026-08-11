#!/usr/bin/env node
/**
 * Serves the `output: 'standalone'` build the way production does.
 *
 * `next start` refuses to support standalone output (it warns and may stop working), so
 * CI e2e runs against `.next/standalone/server.js` — the same entrypoint the Docker image
 * uses. Next emits only the server bundle there; static assets have to be placed next to
 * it, which is exactly what the Dockerfile does with its COPY layers.
 */

import { cpSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const STANDALONE = '.next/standalone';

if (!existsSync(`${STANDALONE}/server.js`)) {
  console.error('No standalone build found — run `npm run build` first.');
  process.exit(1);
}

cpSync('.next/static', `${STANDALONE}/.next/static`, { recursive: true });
if (existsSync('public')) cpSync('public', `${STANDALONE}/public`, { recursive: true });

const server = spawn(process.execPath, ['server.js'], {
  cwd: STANDALONE,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT ?? '3000', HOSTNAME: '0.0.0.0' },
});

server.on('exit', (code) => process.exit(code ?? 0));
