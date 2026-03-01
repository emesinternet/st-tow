export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export type UiRole = 'host' | 'player' | 'observer';

export type UiPhase = 'landing' | 'lobby' | 'match' | 'post';

export interface TeamPlayerViewModel {
  playerId: string;
  displayName: string;
  team: string;
  status: string;
  correctCount: number;
  submitCount: number;
  accuracy: number;
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
  tieZoneStartPercent: number;
  tieZoneEndPercent: number;
  // Instantaneous physics force used by rope integration.
  teamAForce: number;
  // Instantaneous physics force used by rope integration.
  teamBForce: number;
  // Cumulative correct submissions for scoreboard display.
  teamAPulls: number;
  // Cumulative correct submissions for scoreboard display.
  teamBPulls: number;
  hostPowerMeter: number;
  wordMode: string;
  rampTier: number;
  effectiveTier: number;
  activePowerId: string;
  activePowerSecondsRemaining: number | null;
  hostCameraEnabled: boolean;
  hostCameraStreamEpoch: number;
  hostCameraHostIdentity: string | null;
  // Kept for compatibility with existing post-game/stats surfaces.
  hostScore: number | null;
  hostSuccessfulWords: number | null;
  hostCurrentWord: string;
  aliveTeamA: number;
  aliveTeamB: number;
  currentWord: string;
  wordVersion: number;
  mode: string;
  suddenDeathDeadlineMicros: bigint | null;
}

export interface RpsVoteCountsViewModel {
  rock: number;
  paper: number;
  scissors: number;
}

export interface RpsTieBreakViewModel {
  matchId: string;
  roundNumber: number;
  stage: 'Voting' | 'Reveal';
  secondsRemaining: number;
  canVote: boolean;
  myTeam: 'A' | 'B' | '';
  myVote: 'rock' | 'paper' | 'scissors' | '';
  myTeamCounts: RpsVoteCountsViewModel | null;
  opponentTeamCounts: RpsVoteCountsViewModel | null;
  teamAChoice: 'rock' | 'paper' | 'scissors' | '';
  teamBChoice: 'rock' | 'paper' | 'scissors' | '';
  winnerTeam: string;
  canHostContinue: boolean;
}

export interface HostPowerActionViewModel {
  id: string;
  label: string;
  cost: number;
  enabled: boolean;
  disabledReason: string | null;
}

export interface HostPowerCooldownState {
  active: boolean;
  remainingMs: number;
  progress01: number;
}

export interface HostPanelViewModel {
  canStart: boolean;
  canReset: boolean;
  canEndMatch: boolean;
  canToggleCamera: boolean;
  cameraEnabled: boolean;
  startDisabledReason: string | null;
  resetDisabledReason: string | null;
  endDisabledReason: string | null;
  cameraDisabledReason: string | null;
  powers: HostPowerActionViewModel[];
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
  rpsTieBreak: RpsTieBreakViewModel | null;
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
