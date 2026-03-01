import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStressReport, median } from './report';
import type { BotMetrics, LiveRunMetrics, StressConfig } from './types';

test('median computes odd/even and empty inputs', () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([10, 20, 30, 40]), 25);
});

test('buildStressReport aggregates join, submit, vote, and connection totals', () => {
  const config: StressConfig = {
    host: 'ws://127.0.0.1:3000',
    dbName: 'db',
    bots: 2,
    durationMin: 10,
    autoLobbyTimeoutSec: 120,
    submitJitterMinMs: 80,
    submitJitterMaxMs: 220,
    reportJsonPath: 'stress/live/last-report.json',
    seed: 123,
  };

  const bots: BotMetrics[] = [
    {
      botId: 'bot-001',
      displayName: 'Bot001',
      identityHex: 'a',
      joinAttempted: true,
      joinSucceeded: true,
      joinLatencyMs: 100,
      joinError: null,
      submitAttempts: 20,
      submitSuccesses: 18,
      submitErrors: 2,
      voteAttempts: 2,
      voteSuccesses: 2,
      voteErrors: 0,
      disconnects: 1,
      reconnects: 1,
    },
    {
      botId: 'bot-002',
      displayName: 'Bot002',
      identityHex: 'b',
      joinAttempted: true,
      joinSucceeded: false,
      joinLatencyMs: 140,
      joinError: 'fail',
      submitAttempts: 5,
      submitSuccesses: 3,
      submitErrors: 2,
      voteAttempts: 1,
      voteSuccesses: 0,
      voteErrors: 1,
      disconnects: 0,
      reconnects: 0,
    },
  ];

  const run: LiveRunMetrics = {
    lobbyDetectedAtMs: 1000,
    matchDetectedAtMs: 2000,
    inGameStartedAtMs: 3000,
    runEndedAtMs: 7000,
    rpsEntered: true,
    rpsRoundsSeen: new Set([1, 2]),
    phaseDurationsMs: new Map([
      ['InGame', 5000],
      ['TieBreakRps', 2000],
    ]),
    eventCounts: new Map([
      ['player_joined', 10],
      ['rps_vote_cast', 5],
    ]),
  };

  const perMinute = new Map<number, number>([
    [1, 12],
    [2, 9],
  ]);

  const report = buildStressReport(config, run, bots, perMinute);

  assert.equal(report.join.attempted, 2);
  assert.equal(report.join.succeeded, 1);
  assert.equal(report.join.failed, 1);
  assert.equal(report.join.medianLatencyMs, 120);

  assert.equal(report.submit.attempts, 25);
  assert.equal(report.submit.successes, 21);
  assert.equal(report.submit.errors, 4);
  assert.equal(report.submit.successRate, 21 / 25);
  assert.deepEqual(report.submit.perMinute, { '1': 12, '2': 9 });

  assert.equal(report.vote.attempts, 3);
  assert.equal(report.vote.successes, 2);
  assert.equal(report.vote.errors, 1);

  assert.equal(report.connection.disconnects, 1);
  assert.equal(report.connection.reconnects, 1);
  assert.equal(report.matchFlow.rpsRoundsSeen, 2);
  assert.equal(report.eventCountsTop[0]?.type, 'player_joined');
});
