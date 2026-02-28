import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_A, TEAM_B } from '../../core/constants';
import {
  applyHostSubmission,
  applyPlayerCorrectSubmission,
  deriveDifficultyTier,
  deriveSecondsRemaining,
  isPhaseExpired,
} from './runtime';

test('countdown timing helpers model 3s pregame expiration', () => {
  const phaseEndsAt = 3_000_000n;

  assert.equal(deriveSecondsRemaining(phaseEndsAt, 0n), 3);
  assert.equal(deriveSecondsRemaining(phaseEndsAt, 1_000_001n), 2);
  assert.equal(deriveSecondsRemaining(phaseEndsAt, 2_000_001n), 1);
  assert.equal(deriveSecondsRemaining(phaseEndsAt, 3_000_000n), 0);

  assert.equal(isPhaseExpired(phaseEndsAt, 2_999_999n), false);
  assert.equal(isPhaseExpired(phaseEndsAt, 3_000_000n), true);
});

test('deriveDifficultyTier maps elapsed progress to five tiers', () => {
  const startedAt = 1_000_000n;
  const roundSeconds = 100;

  assert.equal(deriveDifficultyTier(startedAt, startedAt, roundSeconds), 1);
  assert.equal(deriveDifficultyTier(startedAt + 19_000_000n, startedAt, roundSeconds), 1);
  assert.equal(deriveDifficultyTier(startedAt + 20_000_000n, startedAt, roundSeconds), 2);
  assert.equal(deriveDifficultyTier(startedAt + 45_000_000n, startedAt, roundSeconds), 3);
  assert.equal(deriveDifficultyTier(startedAt + 79_000_000n, startedAt, roundSeconds), 4);
  assert.equal(deriveDifficultyTier(startedAt + 80_000_000n, startedAt, roundSeconds), 5);
  assert.equal(deriveDifficultyTier(startedAt + 150_000_000n, startedAt, roundSeconds), 5);
});

test('host correct submit increments host score only and keeps host non-eliminable', () => {
  const beforeForces = { teamAForce: 4, teamBForce: 2 };
  const result = applyHostSubmission(
    {
      score: 3,
      currentWord: 'anchor',
      wordVersion: 5,
      lastSubmitAtMicros: 10n,
    },
    'anchor',
    'beacon',
    20n
  );

  assert.equal(result.correct, true);
  assert.equal(result.eliminated, false);
  assert.equal(result.nextState.score, 4);
  assert.equal(result.nextState.currentWord, 'beacon');
  assert.equal(result.nextState.wordVersion, 6);
  assert.deepEqual(beforeForces, { teamAForce: 4, teamBForce: 2 });
});

test('host wrong submit in sudden death style flow does not eliminate host', () => {
  const result = applyHostSubmission(
    {
      score: 7,
      currentWord: 'anchor',
      wordVersion: 2,
      lastSubmitAtMicros: 10n,
    },
    'wrong',
    'beacon',
    30n
  );

  assert.equal(result.correct, false);
  assert.equal(result.eliminated, false);
  assert.equal(result.nextState.score, 7);
  assert.equal(result.nextState.currentWord, 'anchor');
  assert.equal(result.nextState.wordVersion, 2);
});

test('player correct submit increments team force and cumulative pulls', () => {
  const teamA = applyPlayerCorrectSubmission(
    { teamAForce: 0, teamBForce: 0, teamAPulls: 0, teamBPulls: 0 },
    TEAM_A
  );
  assert.equal(teamA.teamAForce, 1);
  assert.equal(teamA.teamAPulls, 1);
  assert.equal(teamA.teamBForce, 0);
  assert.equal(teamA.teamBPulls, 0);

  const teamB = applyPlayerCorrectSubmission(
    { teamAForce: 5, teamBForce: 3, teamAPulls: 8, teamBPulls: 2 },
    TEAM_B
  );
  assert.equal(teamB.teamAForce, 5);
  assert.equal(teamB.teamAPulls, 8);
  assert.equal(teamB.teamBForce, 4);
  assert.equal(teamB.teamBPulls, 3);
});
