import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseHostPowerUsedPayload,
  parsePostGameCloseStartedPayload,
  summarizeHostAccuracy,
  summarizeLatestHostPowerActivation,
  type EventLike,
} from '@/lib/events';

test('parsePostGameCloseStartedPayload parses snake_case payload fields', () => {
  const payload = parsePostGameCloseStartedPayload(
    JSON.stringify({ dismiss_at_micros: '1234567', seconds: 10 })
  );

  assert.ok(payload);
  assert.equal(payload.dismissAtMicros, 1234567n);
  assert.equal(payload.seconds, 10);
});

test('parsePostGameCloseStartedPayload parses camelCase fallback fields', () => {
  const payload = parsePostGameCloseStartedPayload(
    JSON.stringify({ dismissAtMicros: 999999, seconds: '7' })
  );

  assert.ok(payload);
  assert.equal(payload.dismissAtMicros, 999999n);
  assert.equal(payload.seconds, 7);
});

test('parsePostGameCloseStartedPayload returns null without a valid dismiss timestamp', () => {
  const payload = parsePostGameCloseStartedPayload(JSON.stringify({ seconds: 10 }));
  assert.equal(payload, null);
});

test('parsePostGameCloseStartedPayload returns null for invalid json', () => {
  const payload = parsePostGameCloseStartedPayload('{not-json');
  assert.equal(payload, null);
});

test('parseHostPowerUsedPayload parses snake_case fields', () => {
  const payload = parseHostPowerUsedPayload(
    JSON.stringify({ power_id: 'difficulty_up_burst', duration_ms: 0 })
  );

  assert.ok(payload);
  assert.equal(payload.powerId, 'difficulty_up_burst');
  assert.equal(payload.durationMs, 0);
});

test('parseHostPowerUsedPayload parses camelCase fallback fields', () => {
  const payload = parseHostPowerUsedPayload(
    JSON.stringify({ powerId: 'tech_mode_burst', durationMs: '20000' })
  );

  assert.ok(payload);
  assert.equal(payload.powerId, 'tech_mode_burst');
  assert.equal(payload.durationMs, 20000);
});

test('parseHostPowerUsedPayload returns null for invalid payload', () => {
  assert.equal(parseHostPowerUsedPayload(JSON.stringify({ duration_ms: 10 })), null);
  assert.equal(parseHostPowerUsedPayload('{bad-json'), null);
});

test('summarizeHostAccuracy computes host accuracy and zero-attempt fallback', () => {
  const events: EventLike[] = [
    {
      eventId: 'e1',
      matchId: 'match-1',
      type: 'host_submit_ok',
      payloadJson: '{}',
      atMicros: 1n,
    },
    {
      eventId: 'e2',
      matchId: 'match-1',
      type: 'host_submit_bad',
      payloadJson: '{}',
      atMicros: 2n,
    },
    {
      eventId: 'e3',
      matchId: 'match-1',
      type: 'host_submit_ok',
      payloadJson: '{}',
      atMicros: 3n,
    },
    {
      eventId: 'e4',
      matchId: 'match-2',
      type: 'host_submit_bad',
      payloadJson: '{}',
      atMicros: 4n,
    },
  ];

  const summary = summarizeHostAccuracy(events, 'match-1');
  assert.equal(summary.attempts, 3);
  assert.equal(summary.correct, 2);
  assert.equal(summary.accuracy, 67);

  const noAttempts = summarizeHostAccuracy(events, 'missing');
  assert.equal(noAttempts.attempts, 0);
  assert.equal(noAttempts.correct, 0);
  assert.equal(noAttempts.accuracy, 0);
});

test('summarizeHostAccuracy never shows 100 when there are misses', () => {
  const events: EventLike[] = [];
  for (let index = 0; index < 299; index += 1) {
    events.push({
      eventId: `ok-${index}`,
      matchId: 'match-1',
      type: 'host_submit_ok',
      payloadJson: '{}',
      atMicros: BigInt(index + 1),
    });
  }
  events.push({
    eventId: 'bad-1',
    matchId: 'match-1',
    type: 'host_submit_bad',
    payloadJson: '{}',
    atMicros: 999n,
  });

  const summary = summarizeHostAccuracy(events, 'match-1');
  assert.equal(summary.attempts, 300);
  assert.equal(summary.correct, 299);
  assert.equal(summary.accuracy, 99);
});

test('summarizeLatestHostPowerActivation returns the newest valid host power event', () => {
  const events: EventLike[] = [
    {
      eventId: 'e1',
      matchId: 'match-1',
      type: 'host_power_used',
      payloadJson: JSON.stringify({ power_id: 'tech_mode_burst' }),
      atMicros: 10n,
    },
    {
      eventId: 'e2',
      matchId: 'match-1',
      type: 'host_power_used',
      payloadJson: JSON.stringify({ power_id: 'difficulty_up_burst' }),
      atMicros: 30n,
    },
    {
      eventId: 'e3',
      matchId: 'match-1',
      type: 'host_power_used',
      payloadJson: JSON.stringify({ duration_ms: 20000 }),
      atMicros: 50n,
    },
    {
      eventId: 'e4',
      matchId: 'match-2',
      type: 'host_power_used',
      payloadJson: JSON.stringify({ power_id: 'symbols_mode_burst' }),
      atMicros: 100n,
    },
  ];

  const latest = summarizeLatestHostPowerActivation(events, 'match-1');
  assert.ok(latest);
  assert.equal(latest.powerId, 'difficulty_up_burst');
  assert.equal(latest.eventId, 'e2');
  assert.equal(latest.atMicros, 30n);
});
