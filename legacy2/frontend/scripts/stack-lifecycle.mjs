#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(frontendRoot, '..');
const apiRoot = path.join(projectRoot, 'api');

const command = process.argv[2] || 'dev';
const validCommands = new Set(['dev', 'start', 'stop', 'status', 'restart', 'force']);

function runProcess(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: 'inherit',
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve({ code: code ?? 1, signal: signal ?? null });
    });
  });
}

async function runApiVitalSigns(vitalCommand) {
  return runProcess(process.execPath, ['scripts/vitalsigns.mjs', vitalCommand], {
    cwd: apiRoot,
    env: process.env
  });
}

async function checkRescorAvailable() {
  try {
    const result = await runProcess('rescor', ['--help'], {
      cwd: projectRoot,
      env: process.env,
      stdio: 'ignore'
    });

    return result.code === 0;
  } catch {
    return false;
  }
}

async function runRescorStoreValidate() {
  const projectName = process.env.ASR_RESCOR_PROJECT || 'asr.rescor.net';

  const projectList = await runProcess('rescor', ['env', 'list', '--project', projectName, '--format', 'json'], {
    cwd: projectRoot,
    env: process.env
  });

  if (projectList.code === 0) {
    return true;
  }

  const defaultList = await runProcess('rescor', ['env', 'list', '--format', 'json'], {
    cwd: projectRoot,
    env: process.env
  });

  return defaultList.code === 0;
}

async function runRescorPreflight() {
  if (process.env.ASR_RESCOR_VALIDATE === 'false') {
    return;
  }

  const required = process.env.ASR_RESCOR_REQUIRED === 'true';
  const available = await checkRescorAvailable();

  if (!available) {
    const message = 'rescor CLI is not available; skipping store validation preflight';
    if (required) {
      throw new Error(message);
    }
    process.stdout.write(`⚠️  ${message}\n`);
    return;
  }

  const projectName = process.env.ASR_RESCOR_PROJECT || 'asr.rescor.net';
  process.stdout.write(`🔎 Running rescor project preflight for ${projectName}...\n`);
  const ok = await runRescorStoreValidate();
  if (!ok) {
    const message = `rescor project preflight failed for ${projectName}`;
    if (required) {
      throw new Error(message);
    }
    process.stdout.write(`⚠️  ${message} (continuing because ASR_RESCOR_REQUIRED is not true)\n`);
  }
}

async function runDevStack() {
  await runRescorPreflight();

  const startResult = await runApiVitalSigns('start');
  if (startResult.code !== 0) {
    process.exit(startResult.code);
  }

  let shuttingDown = false;
  const devChild = spawn('npm', ['run', 'dev'], {
    cwd: frontendRoot,
    stdio: 'inherit',
    env: process.env
  });

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stdout.write('\n🧹 Stopping ASR API via VitalSigns...\n');
    await runApiVitalSigns('stop');
  };

  process.on('SIGINT', async () => {
    devChild.kill('SIGTERM');
    await shutdown();
    process.exit(130);
  });

  process.on('SIGTERM', async () => {
    devChild.kill('SIGTERM');
    await shutdown();
    process.exit(143);
  });

  devChild.on('exit', async (code) => {
    await shutdown();
    process.exit(code ?? 1);
  });
}

async function main() {
  if (!validCommands.has(command)) {
    process.stdout.write('Usage: node scripts/stack-lifecycle.mjs <dev|start|stop|status|restart|force>\n');
    process.exit(2);
  }

  if (command === 'dev') {
    await runDevStack();
    return;
  }

  if (command === 'start' || command === 'restart' || command === 'force') {
    await runRescorPreflight();
  }

  const result = await runApiVitalSigns(command);
  process.exit(result.code);
}

main().catch((error) => {
  process.stdout.write(`❌ ${error.message}\n`);
  process.exit(1);
});
