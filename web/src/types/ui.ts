export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export type UiRole = 'host' | 'player' | 'observer';

export type UiPhase = 'landing' | 'lobby' | 'match' | 'post';

export interface TeamPlayerViewModel {
  playerId: string;
  displayName: string;
  team: string;
  status: string;
  correctCount: number;
  eliminatedReason: string;
  isYou: boolean;
}

export interface TeamCountViewModel {
  active: number;
  eliminated: number;
  left: number;
  total: number;
}

export interface LobbyViewModel {
  lobbyId: string;
  joinCode: string;
  status: string;
  gameType: string;
  isHost: boolean;
  hostIdentity: string;
  teamA: TeamPlayerViewModel[];
  teamB: TeamPlayerViewModel[];
  teamACounts: TeamCountViewModel;
  teamBCounts: TeamCountViewModel;
}

export interface MatchHudViewModel {
  matchId: string;
  phase: string;
  secondsRemaining: number | null;
  winnerTeam: string;
  ropePosition: number;
  normalizedRopePosition: number;
  winThreshold: number;
  // Instantaneous physics force used by rope integration.
  teamAForce: number;
  // Instantaneous physics force used by rope integration.
  teamBForce: number;
  // Cumulative correct submissions for scoreboard display.
  teamAPulls: number;
  // Cumulative correct submissions for scoreboard display.
  teamBPulls: number;
  // Display-only host score (no gameplay impact yet).
  hostScore: number | null;
  hostCurrentWord: string;
  aliveTeamA: number;
  aliveTeamB: number;
  currentWord: string;
  wordVersion: number;
  mode: string;
  suddenDeathDeadlineMicros: bigint | null;
}

export interface HostPanelViewModel {
  canStart: boolean;
  canReset: boolean;
  canEndMatch: boolean;
  startDisabledReason: string | null;
  resetDisabledReason: string | null;
  endDisabledReason: string | null;
}

export interface PlayerInputViewModel {
  playerId: string;
  playerName: string;
  playerStatus: string;
  eliminatedReason: string;
  currentWord: string;
  canSubmit: boolean;
  disabledReason: string | null;
  deadlineAtMicros: bigint | null;
}

export interface EventFeedItemViewModel {
  eventId: string;
  type: string;
  payloadSummary: string;
  atMicros: bigint;
}

export interface UiViewModel {
  connectionState: ConnectionState;
  role: UiRole;
  phase: UiPhase;
  lobby: LobbyViewModel | null;
  matchHud: MatchHudViewModel | null;
  preMatchHud: MatchHudViewModel | null;
  preMatchSecondsRemaining: number;
  hostPanel: HostPanelViewModel | null;
  playerInput: PlayerInputViewModel | null;
  events: EventFeedItemViewModel[];
}

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  tone: 'neutral' | 'danger' | 'success';
}
