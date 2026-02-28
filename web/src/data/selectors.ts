import type { DbConnection } from '@/module_bindings';

export interface NormalizedLobby {
  lobbyId: string;
  joinCode: string;
  hostIdentity: string;
  status: string;
  gameType: string;
  activeMatchId: string;
  createdAtMicros: bigint;
}

export interface NormalizedLobbySetting {
  settingId: string;
  lobbyId: string;
  key: string;
  valueJson: string;
}

export interface NormalizedPlayer {
  playerId: string;
  lobbyId: string;
  identity: string;
  lobbyIdentityKey: string;
  displayName: string;
  team: string;
  status: string;
  joinedAtMicros: bigint;
  leftAtMicros: bigint;
  eliminatedReason: string;
}

export interface NormalizedMatch {
  matchId: string;
  lobbyId: string;
  gameType: string;
  phase: string;
  startedAtMicros: bigint;
  endsAtMicros: bigint;
  winnerTeam: string;
  winnerPlayerId: string;
  seed: number;
}

export interface NormalizedMatchClock {
  matchId: string;
  phaseEndsAtMicros: bigint;
  secondsRemaining: number;
  tickRateMs: number;
}

export interface NormalizedTugState {
  matchId: string;
  ropePosition: number;
  winThreshold: number;
  teamAForce: number;
  teamBForce: number;
  currentWord: string;
  wordVersion: number;
  mode: string;
  wordRotateMs: number;
  eliminationWordTimeMs: number;
  nextWordAtMicros: bigint;
  lastTickAtMicros: bigint;
}

export interface NormalizedTugPlayerState {
  tugPlayerStateId: string;
  matchId: string;
  playerId: string;
  currentWord: string;
  correctCount: number;
  lastSubmitAtMicros: bigint;
  deadlineAtMicros: bigint;
}

export interface NormalizedTugHostState {
  matchId: string;
  hostIdentity: string;
  score: number;
  currentWord: string;
  wordVersion: number;
  lastSubmitAtMicros: bigint;
}

export interface NormalizedGameEvent {
  eventId: string;
  lobbyId: string;
  matchId: string;
  type: string;
  payloadJson: string;
  atMicros: bigint;
}

export interface SessionSnapshot {
  lobbies: NormalizedLobby[];
  lobbySettings: NormalizedLobbySetting[];
  players: NormalizedPlayer[];
  matches: NormalizedMatch[];
  clocks: NormalizedMatchClock[];
  tugStates: NormalizedTugState[];
  tugPlayerStates: NormalizedTugPlayerState[];
  tugHostStates: NormalizedTugHostState[];
  events: NormalizedGameEvent[];
  generatedAt: number;
}

export const EMPTY_SNAPSHOT: SessionSnapshot = {
  lobbies: [],
  lobbySettings: [],
  players: [],
  matches: [],
  clocks: [],
  tugStates: [],
  tugPlayerStates: [],
  tugHostStates: [],
  events: [],
  generatedAt: 0,
};

type GenericRow = Record<string, unknown>;

function field<T>(row: GenericRow, camel: string, snake: string): T | undefined {
  return (row[camel] ?? row[snake]) as T | undefined;
}

function toIdentityHex(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value && 'toHexString' in value) {
    const maybeIdentity = value as { toHexString?: () => string };
    if (typeof maybeIdentity.toHexString === 'function') {
      return maybeIdentity.toHexString();
    }
  }
  return String(value);
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function microsFromTimestamp(value: unknown): bigint {
  if (value == null) {
    return 0n;
  }
  if (typeof value === 'object') {
    const row = value as GenericRow;
    return toBigInt(row.microsSinceUnixEpoch ?? row.__timestamp_micros_since_unix_epoch__);
  }
  return toBigInt(value);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function tableRows(connection: DbConnection, names: string[]): GenericRow[] {
  for (const name of names) {
    const table = (connection.db as Record<string, unknown>)[name] as
      | { iter: () => Iterable<GenericRow> }
      | undefined;

    if (table && typeof table.iter === 'function') {
      return Array.from(table.iter());
    }
  }

  return [];
}

function normalizeLobby(row: GenericRow): NormalizedLobby {
  return {
    lobbyId: field<string>(row, 'lobbyId', 'lobby_id') ?? '',
    joinCode: field<string>(row, 'joinCode', 'join_code') ?? '',
    hostIdentity: toIdentityHex(field(row, 'hostIdentity', 'host_identity')),
    status: field<string>(row, 'status', 'status') ?? '',
    gameType: field<string>(row, 'gameType', 'game_type') ?? '',
    activeMatchId: field<string>(row, 'activeMatchId', 'active_match_id') ?? '',
    createdAtMicros: microsFromTimestamp(field(row, 'createdAt', 'created_at')),
  };
}

function normalizeLobbySetting(row: GenericRow): NormalizedLobbySetting {
  return {
    settingId: field<string>(row, 'settingId', 'setting_id') ?? '',
    lobbyId: field<string>(row, 'lobbyId', 'lobby_id') ?? '',
    key: field<string>(row, 'key', 'key') ?? '',
    valueJson: field<string>(row, 'valueJson', 'value_json') ?? '',
  };
}

function normalizePlayer(row: GenericRow): NormalizedPlayer {
  return {
    playerId: field<string>(row, 'playerId', 'player_id') ?? '',
    lobbyId: field<string>(row, 'lobbyId', 'lobby_id') ?? '',
    identity: toIdentityHex(field(row, 'identity', 'identity')),
    lobbyIdentityKey: field<string>(row, 'lobbyIdentityKey', 'lobby_identity_key') ?? '',
    displayName: field<string>(row, 'displayName', 'display_name') ?? 'Player',
    team: field<string>(row, 'team', 'team') ?? '',
    status: field<string>(row, 'status', 'status') ?? '',
    joinedAtMicros: microsFromTimestamp(field(row, 'joinedAt', 'joined_at')),
    leftAtMicros: toBigInt(field(row, 'leftAtMicros', 'left_at_micros')),
    eliminatedReason: field<string>(row, 'eliminatedReason', 'eliminated_reason') ?? '',
  };
}

function normalizeMatch(row: GenericRow): NormalizedMatch {
  return {
    matchId: field<string>(row, 'matchId', 'match_id') ?? '',
    lobbyId: field<string>(row, 'lobbyId', 'lobby_id') ?? '',
    gameType: field<string>(row, 'gameType', 'game_type') ?? '',
    phase: field<string>(row, 'phase', 'phase') ?? '',
    startedAtMicros: microsFromTimestamp(field(row, 'startedAt', 'started_at')),
    endsAtMicros: toBigInt(field(row, 'endsAtMicros', 'ends_at_micros')),
    winnerTeam: field<string>(row, 'winnerTeam', 'winner_team') ?? '',
    winnerPlayerId: field<string>(row, 'winnerPlayerId', 'winner_player_id') ?? '',
    seed: toNumber(field(row, 'seed', 'seed')),
  };
}

function normalizeMatchClock(row: GenericRow): NormalizedMatchClock {
  return {
    matchId: field<string>(row, 'matchId', 'match_id') ?? '',
    phaseEndsAtMicros: microsFromTimestamp(field(row, 'phaseEndsAt', 'phase_ends_at')),
    secondsRemaining: toNumber(field(row, 'secondsRemaining', 'seconds_remaining')),
    tickRateMs: toNumber(field(row, 'tickRateMs', 'tick_rate_ms')),
  };
}

function normalizeTugState(row: GenericRow): NormalizedTugState {
  return {
    matchId: field<string>(row, 'matchId', 'match_id') ?? '',
    ropePosition: toNumber(field(row, 'ropePosition', 'rope_position')),
    winThreshold: toNumber(field(row, 'winThreshold', 'win_threshold')),
    teamAForce: toNumber(field(row, 'teamAForce', 'team_a_force')),
    teamBForce: toNumber(field(row, 'teamBForce', 'team_b_force')),
    currentWord: field<string>(row, 'currentWord', 'current_word') ?? '',
    wordVersion: toNumber(field(row, 'wordVersion', 'word_version')),
    mode: field<string>(row, 'mode', 'mode') ?? '',
    wordRotateMs: toNumber(field(row, 'wordRotateMs', 'word_rotate_ms')),
    eliminationWordTimeMs: toNumber(field(row, 'eliminationWordTimeMs', 'elimination_word_time_ms')),
    nextWordAtMicros: toBigInt(field(row, 'nextWordAtMicros', 'next_word_at_micros')),
    lastTickAtMicros: toBigInt(field(row, 'lastTickAtMicros', 'last_tick_at_micros')),
  };
}

function normalizeTugPlayerState(row: GenericRow): NormalizedTugPlayerState {
  return {
    tugPlayerStateId: field<string>(row, 'tugPlayerStateId', 'tug_player_state_id') ?? '',
    matchId: field<string>(row, 'matchId', 'match_id') ?? '',
    playerId: field<string>(row, 'playerId', 'player_id') ?? '',
    currentWord: field<string>(row, 'currentWord', 'current_word') ?? '',
    correctCount: toNumber(field(row, 'correctCount', 'correct_count')),
    lastSubmitAtMicros: toBigInt(field(row, 'lastSubmitAtMicros', 'last_submit_at_micros')),
    deadlineAtMicros: toBigInt(field(row, 'deadlineAtMicros', 'deadline_at_micros')),
  };
}

function normalizeTugHostState(row: GenericRow): NormalizedTugHostState {
  return {
    matchId: field<string>(row, 'matchId', 'match_id') ?? '',
    hostIdentity: toIdentityHex(field(row, 'hostIdentity', 'host_identity')),
    score: toNumber(field(row, 'score', 'score')),
    currentWord: field<string>(row, 'currentWord', 'current_word') ?? '',
    wordVersion: toNumber(field(row, 'wordVersion', 'word_version')),
    lastSubmitAtMicros: toBigInt(field(row, 'lastSubmitAtMicros', 'last_submit_at_micros')),
  };
}

function normalizeGameEvent(row: GenericRow): NormalizedGameEvent {
  return {
    eventId: field<string>(row, 'eventId', 'event_id') ?? '',
    lobbyId: field<string>(row, 'lobbyId', 'lobby_id') ?? '',
    matchId: field<string>(row, 'matchId', 'match_id') ?? '',
    type: field<string>(row, 'type', 'type') ?? '',
    payloadJson: field<string>(row, 'payloadJson', 'payload_json') ?? '',
    atMicros: microsFromTimestamp(field(row, 'at', 'at')),
  };
}

export function extractSnapshot(connection: DbConnection): SessionSnapshot {
  return {
    lobbies: tableRows(connection, ['lobby']).map(normalizeLobby),
    lobbySettings: tableRows(connection, ['lobby_settings', 'lobbySettings']).map(normalizeLobbySetting),
    players: tableRows(connection, ['player']).map(normalizePlayer),
    matches: tableRows(connection, ['match']).map(normalizeMatch),
    clocks: tableRows(connection, ['match_clock', 'matchClock']).map(normalizeMatchClock),
    tugStates: tableRows(connection, ['tug_state', 'tugState']).map(normalizeTugState),
    tugPlayerStates: tableRows(connection, ['tug_player_state', 'tugPlayerState']).map(normalizeTugPlayerState),
    tugHostStates: tableRows(connection, ['tug_host_state', 'tugHostState']).map(normalizeTugHostState),
    events: tableRows(connection, ['game_event', 'gameEvent']).map(normalizeGameEvent),
    generatedAt: Date.now(),
  };
}
