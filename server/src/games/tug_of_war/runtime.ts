import { TEAM_A, TEAM_B } from '../../core/constants';
import { isCorrectWordSubmission } from './gameplay';

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

export function deriveSecondsRemaining(
  phaseEndsAtMicros: bigint,
  nowMicros: bigint
): number {
  const remainingMicros = phaseEndsAtMicros - nowMicros;
  if (remainingMicros <= 0n) {
    return 0;
  }
  return Number((remainingMicros + 999_999n) / 1_000_000n);
}

export function isPhaseExpired(
  phaseEndsAtMicros: bigint,
  nowMicros: bigint
): boolean {
  return nowMicros >= phaseEndsAtMicros;
}

export function applyPlayerCorrectSubmission(
  state: TeamSubmitState,
  team: string
): TeamSubmitState {
  if (team === TEAM_A) {
    return {
      ...state,
      teamAForce: state.teamAForce + 1,
      teamAPulls: state.teamAPulls + 1,
    };
  }
  if (team === TEAM_B) {
    return {
      ...state,
      teamBForce: state.teamBForce + 1,
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

