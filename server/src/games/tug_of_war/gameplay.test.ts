import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExcludedWordsForPlayer,
  isCorrectWordSubmission,
  resolveWinnerFromRopePosition,
  shouldEliminateOnWrongSubmission,
} from './gameplay';

test('buildExcludedWordsForPlayer excludes only other active words', () => {
  const excluded = buildExcludedWordsForPlayer(
    [
      { playerId: 'p1', currentWord: 'anchor' },
      { playerId: 'p2', currentWord: 'beacon' },
      { playerId: 'p3', currentWord: 'caravan' },
    ],
    'p2'
  );

  assert.equal(excluded.has('anchor'), true);
  assert.equal(excluded.has('beacon'), false);
  assert.equal(excluded.has('caravan'), true);
});

test('buildExcludedWordsForPlayer can also exclude the player current word', () => {
  const excluded = buildExcludedWordsForPlayer(
    [
      { playerId: 'p1', currentWord: 'anchor' },
      { playerId: 'p2', currentWord: 'beacon' },
    ],
    'p2',
    { includeSelfCurrentWord: true }
  );

  assert.equal(excluded.has('anchor'), true);
  assert.equal(excluded.has('beacon'), true);
});

test('isCorrectWordSubmission is case-insensitive while preserving exact symbols', () => {
  assert.equal(isCorrectWordSubmission('anchor', 'anchor'), true);
  assert.equal(isCorrectWordSubmission('Anchor', 'anchor'), true);
  assert.equal(isCorrectWordSubmission('a|B', 'a|b'), true);
  assert.equal(isCorrectWordSubmission('a||b', 'a|b'), false);
  assert.equal(isCorrectWordSubmission('anch', 'anchor'), false);
});

test('shouldEliminateOnWrongSubmission only eliminates in elimination mode', () => {
  assert.equal(shouldEliminateOnWrongSubmission('Elimination'), true);
  assert.equal(shouldEliminateOnWrongSubmission('Normal'), false);
});

test('resolveWinnerFromRopePosition resolves A/B/tie from rope sign', () => {
  assert.equal(resolveWinnerFromRopePosition(10), 'A');
  assert.equal(resolveWinnerFromRopePosition(-3), 'B');
  assert.equal(resolveWinnerFromRopePosition(0), '');
});
