import fs from 'node:fs';
import path from 'node:path';
import type { StressConfig } from './types';

export const DEFAULT_BOTS = 50;
export const DEFAULT_DURATION_MIN = 10;
export const DEFAULT_AUTO_LOBBY_TIMEOUT_SEC = 120;
export const DEFAULT_SUBMIT_JITTER_MIN_MS = 220;
export const DEFAULT_SUBMIT_JITTER_MAX_MS = 650;
export const DEFAULT_MISTAKE_RATE_PCT = 20;
export const DEFAULT_REPORT_JSON_PATH = 'stress/live/last-report.json';
export const DEFAULT_HOST = 'ws://127.0.0.1:3000';

interface ParseDeps {
  discoverLatestDbName?: () => string | null;
}

function parseInteger(name: string, value: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }

  const normalized = Math.trunc(parsed);
  if (normalized < min || normalized > max) {
    throw new Error(`Invalid ${name}: ${value}. Expected ${min}..${max}.`);
  }

  return normalized;
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unknown argument: ${token}`);
    }

    const [key, inlineValue] = token.split('=', 2);
    if (inlineValue != null) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for argument: ${key}`);
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export function discoverLatestDbNameFromTmp(root = '/tmp/sttow'): string | null {
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const candidates: Array<{ dbName: string; mtimeMs: number }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const readyPath = path.join(root, entry.name, 'ready.flag');
      if (!fs.existsSync(readyPath)) {
        continue;
      }

      const stat = fs.statSync(readyPath);
      candidates.push({ dbName: entry.name, mtimeMs: stat.mtimeMs });
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates[0].dbName;
  } catch {
    return null;
  }
}

export function parseStressConfig(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  deps: ParseDeps = {}
): StressConfig {
  const args = parseArgs(argv);
  const discoverLatestDbName = deps.discoverLatestDbName ?? discoverLatestDbNameFromTmp;

  const host =
    args['--host'] ?? env.STRESS_SPACETIMEDB_HOST ?? env.VITE_SPACETIMEDB_HOST ?? DEFAULT_HOST;
  const dbName =
    args['--db-name'] ??
    env.STRESS_SPACETIMEDB_DB_NAME ??
    env.VITE_SPACETIMEDB_DB_NAME ??
    env.SPACETIMEDB_DB_NAME ??
    discoverLatestDbName() ??
    'st-tow';

  const bots = args['--bots'] ? parseInteger('bots', args['--bots'], 1, 2000) : DEFAULT_BOTS;
  const durationMin = args['--duration-min']
    ? parseInteger('duration-min', args['--duration-min'], 1, 120)
    : DEFAULT_DURATION_MIN;
  const autoLobbyTimeoutSec = args['--auto-lobby-timeout-sec']
    ? parseInteger('auto-lobby-timeout-sec', args['--auto-lobby-timeout-sec'], 5, 3600)
    : DEFAULT_AUTO_LOBBY_TIMEOUT_SEC;
  const submitJitterMinMs = args['--submit-jitter-min-ms']
    ? parseInteger('submit-jitter-min-ms', args['--submit-jitter-min-ms'], 0, 10_000)
    : DEFAULT_SUBMIT_JITTER_MIN_MS;
  const submitJitterMaxMs = args['--submit-jitter-max-ms']
    ? parseInteger('submit-jitter-max-ms', args['--submit-jitter-max-ms'], 0, 10_000)
    : DEFAULT_SUBMIT_JITTER_MAX_MS;
  const mistakeRatePct = args['--mistake-rate-pct']
    ? parseInteger('mistake-rate-pct', args['--mistake-rate-pct'], 0, 95)
    : DEFAULT_MISTAKE_RATE_PCT;

  if (submitJitterMinMs > submitJitterMaxMs) {
    throw new Error(
      `Invalid submit jitter range: min ${submitJitterMinMs} > max ${submitJitterMaxMs}`
    );
  }

  const reportJsonPath = args['--report-json-path'] ?? DEFAULT_REPORT_JSON_PATH;
  const seed = args['--seed']
    ? parseInteger('--seed', args['--seed'], 1, 2_147_483_647)
    : (Date.now() % 2_147_483_647) + 1;

  return {
    host,
    dbName,
    bots,
    durationMin,
    autoLobbyTimeoutSec,
    submitJitterMinMs,
    submitJitterMaxMs,
    mistakeRatePct,
    reportJsonPath,
    seed,
  };
}

export function getStressUsage(): string {
  return [
    'Usage: npm run stress:live -- [options]',
    '',
    'Options:',
    '  --host <ws://127.0.0.1:3000>',
    '  --db-name <database-name>',
    '  --bots <count>                           (default 50)',
    '  --duration-min <minutes>                 (default 10)',
    '  --auto-lobby-timeout-sec <seconds>       (default 120)',
    '  --submit-jitter-min-ms <ms>              (default 220)',
    '  --submit-jitter-max-ms <ms>              (default 650)',
    '  --mistake-rate-pct <0..95>               (default 20)',
    '  --report-json-path <path>                (default stress/live/last-report.json)',
    '  --seed <int>                             (default current timestamp)',
  ].join('\n');
}
