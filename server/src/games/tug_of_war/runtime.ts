import { TEAM_A, TEAM_B } from '../../core/constants';
import { isCorrectWordSubmission } from './gameplay';
import {
  MAX_WORD_DIFFICULTY_TIER,
  MIN_WORD_DIFFICULTY_TIER,
  type WordDifficultyTier,
} from './word_catalog';

export interface TeamSubmitState {
  teamAForce: number;
  teamBForce: number;
  teamAPulls: number;
  teamBPulls: number;
}

export interface HostSubmitState {
  score: number;
  currentWord: string;
  wordVersion: number;
  lastSubmitAtMicros: bigint;
}

export interface HostSubmitResult {
  correct: boolean;
  eliminated: false;
  nextState: HostSubmitState;
}

const DIFFICULTY_RAMP_EXPONENT = 0.65;

export function deriveSecondsRemaining(phaseEndsAtMicros: bigint, nowMicros: bigint): number {
  const remainingMicros = phaseEndsAtMicros - nowMicros;
  if (remainingMicros <= 0n) {
    return 0;
  }
  return Number((remainingMicros + 999_999n) / 1_000_000n);
}

export function deriveDifficultyTier(
  nowMicros: bigint,
  startedAtMicros: bigint,
  roundSeconds: number
): WordDifficultyTier {
  if (roundSeconds <= 0) {
    return MAX_WORD_DIFFICULTY_TIER;
  }
  const elapsedMicros = nowMicros - startedAtMicros;
  if (elapsedMicros <= 0n) {
    return MIN_WORD_DIFFICULTY_TIER;
  }

  const roundMicros = BigInt(roundSeconds) * 1_000_000n;
  if (roundMicros <= 0n) {
    return MAX_WORD_DIFFICULTY_TIER;
  }

  const clampedElapsed = elapsedMicros > roundMicros ? roundMicros : elapsedMicros;
  const progress = Number(clampedElapsed) / Number(roundMicros);
  const curvedProgress = Math.pow(progress, DIFFICULTY_RAMP_EXPONENT);
  const rawTier = Math.floor(curvedProgress * MAX_WORD_DIFFICULTY_TIER) + 1;
  const boundedTier = Math.max(
    MIN_WORD_DIFFICULTY_TIER,
    Math.min(MAX_WORD_DIFFICULTY_TIER, rawTier)
  );
  return boundedTier as WordDifficultyTier;
}

export function isPhaseExpired(phaseEndsAtMicros: bigint, nowMicros: bigint): boolean {
  return nowMicros >= phaseEndsAtMicros;
}

export function applyPlayerCorrectSubmission(
  state: TeamSubmitState,
  team: string,
  forceGain = 1
): TeamSubmitState {
  const normalizedForceGain = Math.max(0, Math.trunc(forceGain));

  if (team === TEAM_A) {
    return {
      ...state,
      teamAForce: state.teamAForce + normalizedForceGain,
      teamAPulls: state.teamAPulls + 1,
    };
  }
  if (team === TEAM_B) {
    return {
      ...state,
      teamBForce: state.teamBForce + normalizedForceGain,
      teamBPulls: state.teamBPulls + 1,
    };
  }
  return state;
}

export function applyHostSubmission(
  state: HostSubmitState,
  typed: string,
  nextWordOnCorrect: string,
  nowMicros: bigint
): HostSubmitResult {
  const correct = isCorrectWordSubmission(typed, state.currentWord);
  const nextState: HostSubmitState = {
    ...state,
    lastSubmitAtMicros: nowMicros,
  };

  if (correct) {
    nextState.score += 1;
    nextState.wordVersion += 1;
    nextState.currentWord = nextWordOnCorrect;
  }

  return {
    correct,
    eliminated: false,
    nextState,
  };
}
