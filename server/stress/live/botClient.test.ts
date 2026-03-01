import assert from 'node:assert/strict';
import test from 'node:test';
import { nextDelayMs, shouldVoteInRound } from './botClient';

test('nextDelayMs stays within configured range', () => {
  const values = Array.from({ length: 1000 }, () => nextDelayMs(Math.random, 80, 220));

  assert.ok(values.every((value) => value >= 80));
  assert.ok(values.every((value) => value <= 220));
});

test('nextDelayMs returns min when range is collapsed', () => {
  assert.equal(
    nextDelayMs(() => 0.5, 150, 150),
    150
  );
  assert.equal(
    nextDelayMs(() => 0.9, 200, 100),
    200
  );
});

test('shouldVoteInRound allows one vote per round only in voting stage', () => {
  assert.equal(shouldVoteInRound('Voting', 0, 1), true);
  assert.equal(shouldVoteInRound('Voting', 1, 1), false);
  assert.equal(shouldVoteInRound('Voting', 1, 2), true);
  assert.equal(shouldVoteInRound('Reveal', 1, 2), false);
});
