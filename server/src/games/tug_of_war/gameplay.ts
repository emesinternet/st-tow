import {
  TEAM_A,
  TEAM_B,
  TUG_MODE_ELIMINATION,
} from '../../core/constants';

export interface PlayerWordState {
  playerId: string;
  currentWord: string;
}

export interface BuildExcludedWordsOptions {
  includeSelfCurrentWord?: boolean;
}

export function buildExcludedWordsForPlayer(
  states: ReadonlyArray<PlayerWordState>,
  playerId: string,
  options: BuildExcludedWordsOptions = {}
): Set<string> {
  const excluded = new Set<string>();
  const includeSelfCurrentWord = options.includeSelfCurrentWord === true;

  for (const state of states) {
    if (state.playerId === playerId) {
      if (includeSelfCurrentWord && state.currentWord) {
        excluded.add(state.currentWord);
      }
      continue;
    }
    if (state.currentWord) {
      excluded.add(state.currentWord);
    }
  }
  return excluded;
}

export function isCorrectWordSubmission(typed: string, targetWord: string): boolean {
  return typed.toLowerCase() === targetWord.toLowerCase();
}

export function shouldEliminateOnWrongSubmission(mode: string): boolean {
  return mode === TUG_MODE_ELIMINATION;
}

export function resolveWinnerFromRopePosition(ropePosition: number): string {
  if (ropePosition > 0) {
    return TEAM_A;
  }
  if (ropePosition < 0) {
    return TEAM_B;
  }
  return '';
}
