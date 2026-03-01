import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePostGameCloseStartedPayload } from '@/lib/events';

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
