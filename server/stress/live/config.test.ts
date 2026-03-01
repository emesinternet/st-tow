import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AUTO_LOBBY_TIMEOUT_SEC,
  DEFAULT_BOTS,
  DEFAULT_DURATION_MIN,
  DEFAULT_MISTAKE_RATE_PCT,
  DEFAULT_SUBMIT_JITTER_MAX_MS,
  DEFAULT_SUBMIT_JITTER_MIN_MS,
  parseStressConfig,
} from './config';

test('parseStressConfig uses defaults and env db name', () => {
  const config = parseStressConfig([], {
    STRESS_SPACETIMEDB_DB_NAME: 'stress-db',
  });

  assert.equal(config.dbName, 'stress-db');
  assert.equal(config.bots, DEFAULT_BOTS);
  assert.equal(config.durationMin, DEFAULT_DURATION_MIN);
  assert.equal(config.autoLobbyTimeoutSec, DEFAULT_AUTO_LOBBY_TIMEOUT_SEC);
  assert.equal(config.submitJitterMinMs, DEFAULT_SUBMIT_JITTER_MIN_MS);
  assert.equal(config.submitJitterMaxMs, DEFAULT_SUBMIT_JITTER_MAX_MS);
  assert.equal(config.mistakeRatePct, DEFAULT_MISTAKE_RATE_PCT);
});

test('parseStressConfig parses explicit CLI overrides', () => {
  const config = parseStressConfig(
    [
      '--host',
      'ws://localhost:4000',
      '--db-name',
      'db-manual',
      '--bots',
      '250',
      '--duration-min',
      '15',
      '--auto-lobby-timeout-sec',
      '300',
      '--submit-jitter-min-ms',
      '10',
      '--submit-jitter-max-ms',
      '40',
      '--mistake-rate-pct',
      '22',
      '--seed',
      '42',
    ],
    {}
  );

  assert.equal(config.host, 'ws://localhost:4000');
  assert.equal(config.dbName, 'db-manual');
  assert.equal(config.bots, 250);
  assert.equal(config.durationMin, 15);
  assert.equal(config.autoLobbyTimeoutSec, 300);
  assert.equal(config.submitJitterMinMs, 10);
  assert.equal(config.submitJitterMaxMs, 40);
  assert.equal(config.mistakeRatePct, 22);
  assert.equal(config.seed, 42);
});

test('parseStressConfig rejects invalid jitter range', () => {
  assert.throws(
    () =>
      parseStressConfig(['--submit-jitter-min-ms', '500', '--submit-jitter-max-ms', '100'], {
        STRESS_SPACETIMEDB_DB_NAME: 'stress-db',
      }),
    /Invalid submit jitter range/
  );
});
