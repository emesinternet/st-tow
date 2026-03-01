import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExcludedWordsForPlayer,
  isRopeInTieZone,
  isCorrectWordSubmission,
  resolveMajorityRpsChoiceFromCounts,
  resolveRpsWinner,
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

test('isRopeInTieZone applies centered percentage window around zero', () => {
  assert.equal(isRopeInTieZone(0, 100, 10), true);
  assert.equal(isRopeInTieZone(10, 100, 10), true);
  assert.equal(isRopeInTieZone(-10, 100, 10), true);
  assert.equal(isRopeInTieZone(11, 100, 10), false);
  assert.equal(isRopeInTieZone(-12, 100, 10), false);
});

test('resolveMajorityRpsChoiceFromCounts returns majority and blanks ties/empty', () => {
  assert.equal(resolveMajorityRpsChoiceFromCounts({ rock: 3, paper: 1, scissors: 2 }), 'rock');
  assert.equal(resolveMajorityRpsChoiceFromCounts({ rock: 2, paper: 2, scissors: 0 }), '');
  assert.equal(resolveMajorityRpsChoiceFromCounts({ rock: 0, paper: 0, scissors: 0 }), '');
});

test('resolveRpsWinner resolves rock-paper-scissors matrix', () => {
  assert.equal(resolveRpsWinner('rock', 'scissors'), 'A');
  assert.equal(resolveRpsWinner('paper', 'rock'), 'A');
  assert.equal(resolveRpsWinner('scissors', 'paper'), 'A');
  assert.equal(resolveRpsWinner('rock', 'paper'), 'B');
  assert.equal(resolveRpsWinner('scissors', 'rock'), 'B');
  assert.equal(resolveRpsWinner('paper', 'scissors'), 'B');
  assert.equal(resolveRpsWinner('rock', 'rock'), '');
  assert.equal(resolveRpsWinner('', 'rock'), '');
});
