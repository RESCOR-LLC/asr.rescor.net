#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  Recorder,
  VitalSign,
  VitalSigns,
  getEnvNumber,
  getEnvString,
  isTcpPortReachable
} from '@rescor/core-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');

const API_HOST = getEnvString('ASR_API_HOST', '127.0.0.1');
const API_PORT = getEnvNumber('ASR_API_PORT', 5180);
const PID_DIR = path.join(apiRoot, '.pids');
const LOG_DIR = path.join(apiRoot, 'logs');
const PID_FILE = path.join(PID_DIR, 'asr-api.pid');
const PROCESS_LOG_FILE = path.join(LOG_DIR, 'asr-api.out.log');

const recorder = new Recorder(getEnvString('ASR_API_LOG_FILE', 'asr-api.log'), 'asr-vitalsigns');

function getAdapter() {
  return (process.env.ASR_DB_ADAPTER || 'sqlite').toLowerCase();
}

function maskValue(value) {
  if (!value) {
    return '(unset)';
  }

  const text = String(value);
  if (text.length <= 4) {
    return '****';
  }

  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function getVerboseDbTarget() {
  const adapter = getAdapter();

  if (adapter === 'db2') {
    return {
      adapter,
      schema: process.env.ASR_DB2_SCHEMA || 'ASRDEV',
      host: process.env.ASR_DB2_HOST || process.env.DB2_HOST || 'localhost',
      port: Number(process.env.ASR_DB2_PORT || process.env.DB2_PORT || 50000),
      database: process.env.ASR_DB2_DATABASE || process.env.DB2_DATABASE || '(unset)',
      user: maskValue(process.env.ASR_DB2_USER || process.env.DB2_USER),
      connectionString: process.env.ASR_DB2_CONNECTION_STRING ? 'configured' : 'derived-from-env'
    };
  }

  return {
    adapter,
    sqlitePath: process.env.ASR_SQLITE_PATH || './asr.db'
  };
}

async function ensureDirs() {
  await fs.mkdir(PID_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
}

async function readPid() {
  try {
    const raw = await fs.readFile(PID_FILE, 'utf8');
    const pid = Number(raw.trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function clearPid() {
  if (existsSync(PID_FILE)) {
    await fs.unlink(PID_FILE);
  }
}

async function startDetachedApi() {
  await new Promise((resolve, reject) => {
    const migrate = spawn(process.execPath, ['scripts/apply-migrations.mjs'], {
      cwd: apiRoot,
      stdio: 'inherit',
      env: process.env
    });

    migrate.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Migration failed with exit code ${code}`));
    });

    migrate.on('error', reject);
  });

  const logHandle = await fs.open(PROCESS_LOG_FILE, 'a');
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: apiRoot,
    detached: true,
    stdio: ['ignore', logHandle.fd, logHandle.fd],
    env: process.env
  });

  child.unref();
  await logHandle.close();
  await fs.writeFile(PID_FILE, `${child.pid}\n`, 'utf8');

  recorder.emit(7421, 'i', 'Started detached ASR API process', { pid: child.pid, port: API_PORT });
}

async function stopBySignal(signalName) {
  const pid = await readPid();
  if (!pid || !isAlive(pid)) {
    await clearPid();
    return { hadPid: false };
  }

  process.kill(pid, signalName);
  recorder.emit(7422, 'i', 'Sent signal to ASR API process', { pid, signalName });
  return { hadPid: true, pid };
}

function createVitals() {
  return new VitalSigns({
    plans: {
      start: [{ service: 'api', action: 'start' }],
      status: [{ service: 'api', action: 'check' }],
      stop: [{ service: 'api', action: 'stop' }],
      force: [{ service: 'api', action: 'force' }],
      restart: [
        { service: 'api', action: 'stop' },
        { service: 'api', action: 'start' }
      ]
    },
    signs: [
      new VitalSign('api', {
        check: async () => {
          const pid = await readPid();
          const alive = isAlive(pid);
          const reachable = await isTcpPortReachable({ host: API_HOST, port: API_PORT });

          if (reachable) {
            return { state: 'success', data: { pid, alive, reachable } };
          }

          return {
            state: 'hard-fail',
            message: `ASR API is not reachable on ${API_HOST}:${API_PORT}`,
            data: { pid, alive, reachable }
          };
        },
        start: async ({ attempt }) => {
          const reachable = await isTcpPortReachable({ host: API_HOST, port: API_PORT });
          const pid = await readPid();

          if (reachable) {
            return { state: 'success', message: 'ASR API already reachable' };
          }

          if (attempt === 1) {
            if (pid && !isAlive(pid)) {
              await clearPid();
            }
            await startDetachedApi();
          }

          const ready = await isTcpPortReachable({ host: API_HOST, port: API_PORT });
          return ready
            ? { state: 'success' }
            : { state: 'retry', delayMs: 800, message: 'Waiting for ASR API to become reachable' };
        },
        stop: async () => {
          const result = await stopBySignal('SIGTERM');
          if (!result.hadPid) {
            return { state: 'success', message: 'No ASR API PID to stop' };
          }

          await clearPid();
          const reachable = await isTcpPortReachable({ host: API_HOST, port: API_PORT });
          return reachable
            ? { state: 'retry', delayMs: 500, message: 'Waiting for ASR API to stop' }
            : { state: 'success' };
        },
        force: async () => {
          await stopBySignal('SIGKILL');
          await clearPid();
          return { state: 'success' };
        }
      })
    ]
  });
}

function printSummary(summary) {
  for (const result of summary.results) {
    const icon = result.state === 'success' ? '✅' : result.state === 'soft-fail' ? '⚠️' : '❌';
    const message = result.message ? ` - ${result.message}` : '';
    process.stdout.write(`${icon} ${result.service}.${result.action}: ${result.state}${message}\n`);
  }
}

function printVerboseStatus(summary) {
  const apiCheck = summary.results.find((item) => item.service === 'api' && item.action === 'check');
  const runtime = apiCheck?.data || {};
  const target = getVerboseDbTarget();

  process.stdout.write('\nVerbose status\n');
  process.stdout.write(`- adapter: ${target.adapter}\n`);

  if (target.adapter === 'db2') {
    process.stdout.write(`- db2 host: ${target.host}:${target.port}\n`);
    process.stdout.write(`- db2 database: ${target.database}\n`);
    process.stdout.write(`- db2 schema: ${target.schema}\n`);
    process.stdout.write(`- db2 user: ${target.user}\n`);
    process.stdout.write(`- db2 connect mode: ${target.connectionString}\n`);
  } else {
    process.stdout.write(`- sqlite path: ${target.sqlitePath}\n`);
  }

  process.stdout.write(`- api host: ${API_HOST}:${API_PORT}\n`);
  process.stdout.write(`- pid: ${runtime.pid ?? '(none)'}\n`);
  process.stdout.write(`- alive: ${runtime.alive === true ? 'yes' : 'no'}\n`);
  process.stdout.write(`- reachable: ${runtime.reachable === true ? 'yes' : 'no'}\n`);
}

async function main() {
  await ensureDirs();

  const command = process.argv[2] || 'status';
  const verbose = process.argv.includes('--verbose');
  if (!['start', 'stop', 'status', 'force', 'restart'].includes(command)) {
    process.stdout.write('Usage: node scripts/vitalsigns.mjs <start|stop|status|force|restart> [--verbose]\n');
    process.exit(2);
  }

  const vitals = createVitals();
  try {
    const summary = await vitals.run(command, {
      failFast: command !== 'status'
    });

    printSummary(summary);
    if (verbose && command === 'status') {
      printVerboseStatus(summary);
    }
    process.exit(summary.success ? 0 : 1);
  } catch (error) {
    recorder.emit(7429, 'e', 'VitalSigns command failed', { command, error: error.message });
    process.stdout.write(`❌ ${error.name}: ${error.message}\n`);
    process.exit(1);
  }
}

main();
