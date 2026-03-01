export interface StressConfig {
  host: string;
  dbName: string;
  bots: number;
  durationMin: number;
  autoLobbyTimeoutSec: number;
  submitJitterMinMs: number;
  submitJitterMaxMs: number;
  mistakeRatePct: number;
  reportJsonPath: string;
  seed: number;
}

export type MatchPhase =
  | 'Waiting'
  | 'PreGame'
  | 'InGame'
  | 'SuddenDeath'
  | 'TieBreakRps'
  | 'PostGame'
  | string;

export type RpsChoice = 'rock' | 'paper' | 'scissors';

export interface BotMetrics {
  botId: string;
  displayName: string;
  identityHex: string;
  joinAttempted: boolean;
  joinSucceeded: boolean;
  joinLatencyMs: number | null;
  joinError: string | null;
  submitAttempts: number;
  submitSuccesses: number;
  submitErrors: number;
  voteAttempts: number;
  voteSuccesses: number;
  voteErrors: number;
  disconnects: number;
  reconnects: number;
}

export interface JoinSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  medianLatencyMs: number;
}

export interface SubmitSummary {
  attempts: number;
  successes: number;
  errors: number;
  successRate: number;
  perMinute: Record<string, number>;
}

export interface VoteSummary {
  attempts: number;
  successes: number;
  errors: number;
}

export interface ConnectionSummary {
  disconnects: number;
  reconnects: number;
}

export interface MatchFlowSummary {
  lobbyDetectedAtIso: string | null;
  matchDetectedAtIso: string | null;
  inGameStartedAtIso: string | null;
  runEndedAtIso: string;
  rpsEntered: boolean;
  rpsRoundsSeen: number;
  phaseDurationsMs: Record<string, number>;
}

export interface StressRunReport {
  config: StressConfig;
  generatedAtIso: string;
  join: JoinSummary;
  submit: SubmitSummary;
  vote: VoteSummary;
  connection: ConnectionSummary;
  matchFlow: MatchFlowSummary;
  eventCountsTop: Array<{ type: string; count: number }>;
  bots: BotMetrics[];
}

export interface LiveSnapshot {
  lobbies: LiveLobbyRow[];
  matches: LiveMatchRow[];
  players: LivePlayerRow[];
  tugPlayerStates: LiveTugPlayerStateRow[];
  tugRpsStates: LiveTugRpsStateRow[];
  events: LiveGameEventRow[];
  generatedAtMs: number;
}

export interface LiveLobbyRow {
  lobbyId: string;
  joinCode: string;
  hostIdentityHex: string;
  status: string;
  gameType: string;
  activeMatchId: string;
  createdAtMicros: bigint;
}

export interface LiveMatchRow {
  matchId: string;
  lobbyId: string;
  phase: string;
  winnerTeam: string;
}

export interface LivePlayerRow {
  playerId: string;
  lobbyId: string;
  identityHex: string;
  displayName: string;
  status: string;
  team: string;
}

export interface LiveTugPlayerStateRow {
  tugPlayerStateId: string;
  matchId: string;
  playerId: string;
  currentWord: string;
  wordVersion: number;
}

export interface LiveTugRpsStateRow {
  matchId: string;
  roundNumber: number;
  stage: string;
}

export interface LiveGameEventRow {
  eventId: string;
  lobbyId: string;
  matchId: string;
  type: string;
}

export interface LiveRunMetrics {
  lobbyDetectedAtMs: number | null;
  matchDetectedAtMs: number | null;
  inGameStartedAtMs: number | null;
  runEndedAtMs: number;
  rpsEntered: boolean;
  rpsRoundsSeen: Set<number>;
  phaseDurationsMs: Map<string, number>;
  eventCounts: Map<string, number>;
}
