import { TEAM_A, TEAM_B } from '../../core/constants';
import { isCorrectWordSubmission } from './gameplay';
import type { WordDifficultyTier } from './word_catalog';

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
    return 5;
  }
  const elapsedMicros = nowMicros - startedAtMicros;
  if (elapsedMicros <= 0n) {
    return 1;
  }

  const roundMicros = BigInt(roundSeconds) * 1_000_000n;
  if (roundMicros <= 0n) {
    return 5;
  }

  const progress =
    Number(elapsedMicros > roundMicros ? roundMicros : elapsedMicros) / Number(roundMicros);
  if (progress < 0.2) {
    return 1;
  }
  if (progress < 0.4) {
    return 2;
  }
  if (progress < 0.6) {
    return 3;
  }
  if (progress < 0.8) {
    return 4;
  }
  return 5;
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
