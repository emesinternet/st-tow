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

export type RpsChoice = 'rock' | 'paper' | 'scissors';

export interface RpsChoiceCounts {
  rock: number;
  paper: number;
  scissors: number;
}

export function isRopeInTieZone(
  ropePosition: number,
  winThreshold: number,
  tieZonePercent: number
): boolean {
  if (winThreshold <= 0) {
    return true;
  }
  const clampedPercent = Math.max(0, Math.min(100, tieZonePercent));
  const centerWindow = (winThreshold * clampedPercent) / 100;
  return Math.abs(ropePosition) <= centerWindow;
}

export function resolveMajorityRpsChoiceFromCounts(
  counts: RpsChoiceCounts
): RpsChoice | '' {
  const rows: Array<{ choice: RpsChoice; count: number }> = [
    { choice: 'rock', count: counts.rock },
    { choice: 'paper', count: counts.paper },
    { choice: 'scissors', count: counts.scissors },
  ];
  rows.sort((left, right) => right.count - left.count);

  if (rows[0].count <= 0) {
    return '';
  }
  if (rows[1].count === rows[0].count) {
    return '';
  }

  return rows[0].choice;
}

export function resolveRpsWinner(
  teamAChoice: RpsChoice | '',
  teamBChoice: RpsChoice | ''
): string {
  if (!teamAChoice || !teamBChoice || teamAChoice === teamBChoice) {
    return '';
  }

  if (
    (teamAChoice === 'rock' && teamBChoice === 'scissors') ||
    (teamAChoice === 'paper' && teamBChoice === 'rock') ||
    (teamAChoice === 'scissors' && teamBChoice === 'paper')
  ) {
    return TEAM_A;
  }

  return TEAM_B;
}
