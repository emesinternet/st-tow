import assert from 'node:assert/strict';
import test from 'node:test';
import {
  lobbyIdentityKey,
  makeJoinCode,
  msToMicros,
  newId,
  normalizeDisplayName,
  nowMicros,
  parseNumberJson,
  scheduleId,
  settingId,
  tugPlayerStateId,
} from './helpers';

test('msToMicros converts milliseconds to microseconds', () => {
  assert.equal(msToMicros(250), 250000n);
});

test('normalizeDisplayName trims, defaults, and clamps', () => {
  assert.equal(normalizeDisplayName('  '), 'Player');
  assert.equal(normalizeDisplayName('  Alice  '), 'Alice');
  assert.equal(normalizeDisplayName('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnopqrstuvwx');
});

test('parseNumberJson accepts JSON and raw numeric strings', () => {
  assert.equal(parseNumberJson('"120"'), 120);
  assert.equal(parseNumberJson('45'), 45);
  assert.equal(parseNumberJson('not-a-number'), null);
});

test('id helpers compose deterministic identifiers', () => {
  assert.equal(settingId('lobby-1', 'round_seconds'), 'lobby-1:round_seconds');
  assert.equal(scheduleId('match-1', 'tick'), 'match-1:tick');
  assert.equal(tugPlayerStateId('match-1', 'player-1'), 'match-1:player-1');
});

test('newId and nowMicros read reducer context fields', () => {
  const ctx = {
    newUuidV7: () => ({ toString: () => 'uuid-123' }),
    timestamp: { microsSinceUnixEpoch: 777n },
  } as any;

  assert.equal(newId(ctx, 'match'), 'match_uuid-123');
  assert.equal(nowMicros(ctx), 777n);
});

test('makeJoinCode uses allowed alphabet and requested length', () => {
  let roll = 0;
  const ctx = {
    random: {
      integerInRange: (_min: number, _max: number) => {
        const value = roll % 10;
        roll += 1;
        return value;
      },
    },
  } as any;

  const code = makeJoinCode(ctx, 8);
  assert.equal(code.length, 8);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
});

test('lobbyIdentityKey uses identity hex representation', () => {
  const identity = {
    toHexString: () => 'abc123',
  } as any;

  assert.equal(lobbyIdentityKey('lobby-1', identity), 'lobby-1:abc123');
});
