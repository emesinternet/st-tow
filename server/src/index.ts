import { ScheduleAt, Timestamp } from 'spacetimedb';
import {
  schema,
  table,
  t,
  type Infer,
  type InferTypeOfRow,
  type ReducerCtx,
} from 'spacetimedb/server';
import {
  DEFAULT_LOBBY_SETTINGS,
  GAME_TYPE_TUG_OF_WAR,
  HOST_POWER_DIFFICULTY_UP_BURST,
  HOST_POWER_SYMBOLS_MODE_BURST,
  HOST_POWER_TECH_MODE_BURST,
  LOBBY_SETTING_KEYS,
  LOBBY_STATUS_FINISHED,
  LOBBY_STATUS_RUNNING,
  LOBBY_STATUS_SUDDEN_DEATH,
  LOBBY_STATUS_WAITING,
  MATCH_PHASE_IN_GAME,
  MATCH_PHASE_POST_GAME,
  MATCH_PHASE_SUDDEN_DEATH,
  MATCH_PHASE_TIE_BREAK_RPS,
  MATCH_PHASE_PRE_GAME,
  PLAYER_STATUS_ACTIVE,
  PLAYER_STATUS_ELIMINATED,
  PLAYER_STATUS_LEFT,
  TEAM_A,
  TEAM_B,
  TUG_MODE_ELIMINATION,
  TUG_MODE_NORMAL,
  WORD_MODE_NORMAL,
  WORD_MODE_SYMBOLS,
  WORD_MODE_TECH,
} from './core/constants';
import {
  lobbyIdentityKey,
  makeJoinCode,
  msToMicros,
  newId,
  normalizeDisplayName,
  nowMicros,
  parseNumberJson,
  scheduleId,
  settingId,
  tugPlayerStateId,
} from './core/helpers';
import { pickWordForContext } from './games/tug_of_war/words';
import {
  buildExcludedWordsForPlayer,
  isRopeInTieZone,
  isCorrectWordSubmission,
  resolveMajorityRpsChoiceFromCounts,
  resolveRpsWinner,
  type RpsChoice,
  resolveWinnerFromRopePosition,
  shouldEliminateOnWrongSubmission,
} from './games/tug_of_war/gameplay';
import {
  applyHostSubmission,
  applyPlayerCorrectSubmission,
  deriveDifficultyTier,
  deriveSecondsRemaining,
  isPhaseExpired,
} from './games/tug_of_war/runtime';
import type {
  WordDifficultyTier,
  WordEntry,
  WordMode,
  WordType,
} from './games/tug_of_war/word_catalog';

const lobbyRow = {
  lobby_id: t.string().primaryKey(),
  join_code: t.string().unique(),
  host_identity: t.identity().index(),
  status: t.string().index(),
  game_type: t.string(),
  active_match_id: t.string(),
  created_at: t.timestamp(),
};

const lobbySettingsRow = {
  setting_id: t.string().primaryKey(),
  lobby_id: t.string().index(),
  key: t.string().index(),
  value_json: t.string(),
};

const playerRow = {
  player_id: t.string().primaryKey(),
  lobby_id: t.string().index(),
  identity: t.identity().index(),
  lobby_identity_key: t.string().unique(),
  display_name: t.string(),
  team: t.string().index(),
  status: t.string().index(),
  joined_at: t.timestamp(),
  left_at_micros: t.i64(),
  eliminated_reason: t.string(),
};

const matchRow = {
  match_id: t.string().primaryKey(),
  lobby_id: t.string().index(),
  game_type: t.string().index(),
  phase: t.string().index(),
  started_at: t.timestamp(),
  ends_at_micros: t.i64(),
  winner_team: t.string(),
  winner_player_id: t.string(),
  seed: t.u32(),
};

const matchClockRow = {
  match_id: t.string().primaryKey(),
  phase_ends_at: t.timestamp(),
  seconds_remaining: t.i32(),
  tick_rate_ms: t.i32(),
};

const matchScheduleRow = t.row({
  scheduled_id: t.u64().primaryKey().autoInc(),
  schedule_key: t.string().unique(),
  match_id: t.string().index(),
  kind: t.string(),
  active: t.bool(),
  scheduled_at: t.scheduleAt(),
});

const gameEventRow = {
  event_id: t.string().primaryKey(),
  lobby_id: t.string().index(),
  match_id: t.string().index(),
  type: t.string().index(),
  payload_json: t.string(),
  at: t.timestamp(),
};

const tugStateRow = {
  match_id: t.string().primaryKey(),
  rope_position: t.i32(),
  win_threshold: t.i32(),
  tie_zone_percent: t.i32(),
  team_a_force: t.i32(),
  team_b_force: t.i32(),
  current_word: t.string(),
  word_version: t.i32(),
  mode: t.string().index(),
  word_mode: t.string().index(),
  ramp_tier: t.i32(),
  difficulty_bonus_tier: t.i32(),
  active_power_id: t.string(),
  power_expires_at_micros: t.i64(),
  word_rotate_ms: t.i32(),
  elimination_word_time_ms: t.i32(),
  next_word_at_micros: t.i64(),
  last_tick_at_micros: t.i64(),
};

const tugPlayerStateRow = {
  tug_player_state_id: t.string().primaryKey(),
  match_id: t.string().index(),
  player_id: t.string().index(),
  current_word: t.string(),
  last_word_type: t.string(),
  correct_count: t.i32(),
  submit_count: t.i32(),
  last_submit_at_micros: t.i64(),
  deadline_at_micros: t.i64(),
};

const tugHostStateRow = {
  match_id: t.string().primaryKey(),
  host_identity: t.identity().index(),
  score: t.i32(),
  correct_count: t.i32(),
  power_meter: t.i32(),
  current_word: t.string(),
  last_word_type: t.string(),
  word_version: t.i32(),
  last_submit_at_micros: t.i64(),
};

const tugRpsStateRow = {
  match_id: t.string().primaryKey(),
  round_number: t.i32(),
  stage: t.string().index(),
  voting_ends_at_micros: t.i64(),
  team_a_choice: t.string(),
  team_b_choice: t.string(),
  winner_team: t.string(),
  created_at_micros: t.i64(),
};

const tugRpsVoteRow = {
  tug_rps_vote_id: t.string().primaryKey(),
  match_id: t.string().index(),
  player_id: t.string().index(),
  team: t.string().index(),
  choice: t.string(),
  submitted_at_micros: t.i64(),
};

const spacetimedb = schema({
  lobby: table({ public: true }, lobbyRow),
  lobby_settings: table(
    {
      public: true,
      indexes: [
        {
          accessor: 'by_lobby_key',
          algorithm: 'btree',
          columns: ['lobby_id', 'key'],
        },
      ],
    },
    lobbySettingsRow
  ),
  player: table(
    {
      public: true,
      indexes: [
        {
          accessor: 'by_lobby_status',
          algorithm: 'btree',
          columns: ['lobby_id', 'status'],
        },
        {
          accessor: 'by_lobby_team',
          algorithm: 'btree',
          columns: ['lobby_id', 'team'],
        },
      ],
    },
    playerRow
  ),
  match: table(
    {
      public: true,
      indexes: [
        {
          accessor: 'by_lobby_match',
          algorithm: 'btree',
          columns: ['lobby_id', 'match_id'],
        },
        {
          accessor: 'by_lobby_game_type',
          algorithm: 'btree',
          columns: ['lobby_id', 'game_type'],
        },
      ],
    },
    matchRow
  ),
  match_clock: table({ public: true }, matchClockRow),
  match_schedule: table(
    {
      name: 'schedule',
      scheduled: (): any => tug_tick_scheduled,
    },
    matchScheduleRow
  ),
  game_event: table({ public: true }, gameEventRow),
  tug_state: table({ public: true }, tugStateRow),
  tug_player_state: table(
    {
      public: true,
      indexes: [
        {
          accessor: 'by_match_player',
          algorithm: 'btree',
          columns: ['match_id', 'player_id'],
        },
        {
          accessor: 'by_match_deadline',
          algorithm: 'btree',
          columns: ['match_id', 'deadline_at_micros'],
        },
      ],
    },
    tugPlayerStateRow
  ),
  tug_host_state: table({ public: true }, tugHostStateRow),
  tug_rps_state: table({ public: true }, tugRpsStateRow),
  tug_rps_vote: table(
    {
      public: true,
      indexes: [
        {
          accessor: 'by_match_team',
          algorithm: 'btree',
          columns: ['match_id', 'team'],
        },
      ],
    },
    tugRpsVoteRow
  ),
});

export default spacetimedb;

type LobbyRow = InferTypeOfRow<typeof lobbyRow>;
type PlayerRow = InferTypeOfRow<typeof playerRow>;
type MatchRow = InferTypeOfRow<typeof matchRow>;
type MatchClockRow = InferTypeOfRow<typeof matchClockRow>;
type TugStateRow = InferTypeOfRow<typeof tugStateRow>;
type TugPlayerStateRow = InferTypeOfRow<typeof tugPlayerStateRow>;
type TugHostStateRow = InferTypeOfRow<typeof tugHostStateRow>;
type TugRpsStateRow = InferTypeOfRow<typeof tugRpsStateRow>;
type TugRpsVoteRow = InferTypeOfRow<typeof tugRpsVoteRow>;
type MatchScheduleRow = Infer<typeof matchScheduleRow>;

const PRE_GAME_COUNTDOWN_SECONDS = 3;
const HOST_POWER_METER_MAX = 100;
const RPS_VOTE_SECONDS = 10;
const RPS_STAGE_VOTING = 'Voting';
const RPS_STAGE_REVEAL = 'Reveal';
const TIE_ZONE_PERCENT_OPTIONS = new Set([10, 20, 30, 40]);

type HostPowerId =
  | typeof HOST_POWER_TECH_MODE_BURST
  | typeof HOST_POWER_SYMBOLS_MODE_BURST
  | typeof HOST_POWER_DIFFICULTY_UP_BURST;

interface HostPowerConfig {
  id: HostPowerId;
  cost: number;
  durationMs: number;
  wordMode: WordMode | null;
  difficultyBonusTier: number;
}

const HOST_POWER_CONFIG: Record<HostPowerId, HostPowerConfig> = {
  [HOST_POWER_TECH_MODE_BURST]: {
    id: HOST_POWER_TECH_MODE_BURST,
    cost: 1,
    durationMs: 20_000,
    wordMode: WORD_MODE_TECH,
    difficultyBonusTier: 0,
  },
  [HOST_POWER_SYMBOLS_MODE_BURST]: {
    id: HOST_POWER_SYMBOLS_MODE_BURST,
    cost: 1,
    durationMs: 20_000,
    wordMode: WORD_MODE_SYMBOLS,
    difficultyBonusTier: 0,
  },
  [HOST_POWER_DIFFICULTY_UP_BURST]: {
    id: HOST_POWER_DIFFICULTY_UP_BURST,
    cost: 1,
    durationMs: 20_000,
    wordMode: null,
    difficultyBonusTier: 1,
  },
};

function isWordMode(value: string): value is WordMode {
  return (
    value === WORD_MODE_NORMAL ||
    value === WORD_MODE_TECH ||
    value === WORD_MODE_SYMBOLS
  );
}

function isValidTieZonePercent(value: number): boolean {
  return TIE_ZONE_PERCENT_OPTIONS.has(value);
}

function clampTier(value: number): WordDifficultyTier {
  if (value <= 1) {
    return 1;
  }
  if (value >= 5) {
    return 5;
  }
  return value as WordDifficultyTier;
}

function replaceRow(table: any, current: any, next: any): void {
  table.delete(current);
  table.insert(next);
}

function findFirst<T>(
  rows: Iterable<T>,
  predicate: (row: T) => boolean
): T | null {
  for (const row of rows) {
    if (predicate(row)) {
      return row;
    }
  }
  return null;
}

function emitGameEvent(
  ctx: ReducerCtx<any>,
  lobbyId: string,
  matchId: string,
  type: string,
  payload: Record<string, unknown>
): void {
  ctx.db.game_event.insert({
    event_id: newId(ctx, 'evt'),
    lobby_id: lobbyId,
    match_id: matchId,
    type,
    payload_json: JSON.stringify(payload),
    at: ctx.timestamp,
  });
}

function getLobbyOrThrow(ctx: ReducerCtx<any>, lobbyId: string): LobbyRow {
  const lobby = getLobbyById(ctx, lobbyId);
  if (!lobby) {
    throw new Error('Lobby not found');
  }
  return lobby;
}

function getMatchOrThrow(ctx: ReducerCtx<any>, matchId: string): MatchRow {
  const match = getMatchById(ctx, matchId);
  if (!match) {
    throw new Error('Match not found');
  }
  return match;
}

function getLobbyById(ctx: ReducerCtx<any>, lobbyId: string): LobbyRow | null {
  return findFirst<LobbyRow>(
    ctx.db.lobby.iter() as Iterable<LobbyRow>,
    row => row.lobby_id === lobbyId
  );
}

function getMatchById(ctx: ReducerCtx<any>, matchId: string): MatchRow | null {
  return findFirst<MatchRow>(
    ctx.db.match.iter() as Iterable<MatchRow>,
    row => row.match_id === matchId
  );
}

function getLobbyByJoinCode(
  ctx: ReducerCtx<any>,
  joinCode: string
): LobbyRow | null {
  return findFirst<LobbyRow>(
    ctx.db.lobby.iter() as Iterable<LobbyRow>,
    row => row.join_code === joinCode
  );
}

function getMatchClockByMatchId(
  ctx: ReducerCtx<any>,
  matchId: string
): MatchClockRow | null {
  return findFirst<MatchClockRow>(
    ctx.db.match_clock.iter() as Iterable<MatchClockRow>,
    row => row.match_id === matchId
  );
}

function getTugStateByMatchId(
  ctx: ReducerCtx<any>,
  matchId: string
): TugStateRow | null {
  return findFirst<TugStateRow>(
    ctx.db.tug_state.iter() as Iterable<TugStateRow>,
    row => row.match_id === matchId
  );
}

function getTugPlayerStateById(
  ctx: ReducerCtx<any>,
  rowId: string
): TugPlayerStateRow | null {
  return findFirst<TugPlayerStateRow>(
    ctx.db.tug_player_state.iter() as Iterable<TugPlayerStateRow>,
    row => row.tug_player_state_id === rowId
  );
}

function getTugHostStateByMatchId(
  ctx: ReducerCtx<any>,
  matchId: string
): TugHostStateRow | null {
  return findFirst<TugHostStateRow>(
    ctx.db.tug_host_state.iter() as Iterable<TugHostStateRow>,
    row => row.match_id === matchId
  );
}

function getTugRpsStateByMatchId(
  ctx: ReducerCtx<any>,
  matchId: string
): TugRpsStateRow | null {
  return findFirst<TugRpsStateRow>(
    ctx.db.tug_rps_state.iter() as Iterable<TugRpsStateRow>,
    row => row.match_id === matchId
  );
}

function listTugRpsVotesByMatch(
  ctx: ReducerCtx<any>,
  matchId: string
): TugRpsVoteRow[] {
  const rows: TugRpsVoteRow[] = [];
  for (const row of ctx.db.tug_rps_vote.iter() as Iterable<TugRpsVoteRow>) {
    if (row.match_id === matchId) {
      rows.push(row);
    }
  }
  return rows;
}

function clearTugRpsVotesByMatch(ctx: ReducerCtx<any>, matchId: string): void {
  for (const row of listTugRpsVotesByMatch(ctx, matchId)) {
    ctx.db.tug_rps_vote.delete(row);
  }
}

function clearTugRpsStateForMatch(ctx: ReducerCtx<any>, matchId: string): void {
  const row = getTugRpsStateByMatchId(ctx, matchId);
  if (row) {
    ctx.db.tug_rps_state.delete(row);
  }
}

function getPlayerById(ctx: ReducerCtx<any>, playerId: string): PlayerRow | null {
  return findFirst<PlayerRow>(
    ctx.db.player.iter() as Iterable<PlayerRow>,
    row => row.player_id === playerId
  );
}

function listTugPlayerStatesByMatch(
  ctx: ReducerCtx<any>,
  matchId: string
): TugPlayerStateRow[] {
  const rows: TugPlayerStateRow[] = [];
  for (const row of ctx.db.tug_player_state.iter() as Iterable<TugPlayerStateRow>) {
    if (row.match_id === matchId) {
      rows.push(row);
    }
  }
  return rows;
}

function resolveWordMode(value: string): WordMode {
  if (isWordMode(value)) {
    return value;
  }
  return WORD_MODE_NORMAL;
}

function deriveBaseDifficultyTier(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow
): WordDifficultyTier {
  if (match.phase === MATCH_PHASE_SUDDEN_DEATH) {
    return 5;
  }
  const roundSeconds = getLobbySettingInt(
    ctx,
    lobby.lobby_id,
    LOBBY_SETTING_KEYS.round_seconds,
    DEFAULT_LOBBY_SETTINGS.round_seconds
  );
  return deriveDifficultyTier(
    nowMicros(ctx),
    match.started_at.microsSinceUnixEpoch,
    roundSeconds
  );
}

function deriveEffectiveDifficultyTier(
  baseTier: WordDifficultyTier,
  difficultyBonusTier: number
): WordDifficultyTier {
  return clampTier(baseTier + Math.max(0, difficultyBonusTier));
}

function pickWordForPlayer(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow,
  playerId: string,
  lastWordType: string,
  includeSelfCurrentWord = false
): WordEntry {
  const playerStates = listTugPlayerStatesByMatch(ctx, match.match_id).map(row => ({
    playerId: row.player_id,
    currentWord: row.current_word,
  }));
  const excluded = buildExcludedWordsForPlayer(
    playerStates,
    playerId,
    { includeSelfCurrentWord }
  );
  const baseTier = deriveBaseDifficultyTier(ctx, lobby, match);
  const maxDifficultyTier = deriveEffectiveDifficultyTier(
    baseTier,
    tug.difficulty_bonus_tier
  );
  return pickWordForContext(ctx, {
    mode: resolveWordMode(tug.word_mode),
    maxDifficultyTier,
    excluded,
    lastWordType: (lastWordType || null) as WordType | null,
  });
}

function pickWordForHost(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow,
  lastWordType: string,
  includeCurrentWord = false
): WordEntry {
  const excluded = new Set<string>();

  for (const row of listTugPlayerStatesByMatch(ctx, match.match_id)) {
    if (row.current_word) {
      excluded.add(row.current_word);
    }
  }

  if (includeCurrentWord) {
    const hostState = getTugHostStateByMatchId(ctx, match.match_id);
    if (hostState?.current_word) {
      excluded.add(hostState.current_word);
    }
  }

  const baseTier = deriveBaseDifficultyTier(ctx, lobby, match);
  const maxDifficultyTier = deriveEffectiveDifficultyTier(
    baseTier,
    tug.difficulty_bonus_tier
  );
  return pickWordForContext(ctx, {
    mode: resolveWordMode(tug.word_mode),
    maxDifficultyTier,
    excluded,
    lastWordType: (lastWordType || null) as WordType | null,
  });
}

function ensureTugPlayerStateForActiveMatch(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  player: PlayerRow
): void {
  if (!lobby.active_match_id || lobby.game_type !== GAME_TYPE_TUG_OF_WAR) {
    return;
  }

  const match = getMatchById(ctx, lobby.active_match_id);
  if (!match) {
    return;
  }

  if (
    match.phase !== MATCH_PHASE_PRE_GAME &&
    match.phase !== MATCH_PHASE_IN_GAME &&
    match.phase !== MATCH_PHASE_SUDDEN_DEATH
  ) {
    return;
  }

  const id = tugPlayerStateId(match.match_id, player.player_id);
  const existing = getTugPlayerStateById(ctx, id);
  const tug = getTugStateByMatchId(ctx, match.match_id);
  if (!tug) {
    return;
  }
  const now = nowMicros(ctx);
  const deadline =
    match.phase === MATCH_PHASE_SUDDEN_DEATH
      ? now + msToMicros(tug.elimination_word_time_ms)
      : 0n;

  if (existing) {
    const nextWord = existing.current_word
      ? null
      : pickWordForPlayer(
          ctx,
          lobby,
          match,
          tug,
          player.player_id,
          existing.last_word_type
        );
    replaceRow(ctx.db.tug_player_state, existing, {
      ...existing,
      current_word: nextWord?.value ?? existing.current_word,
      last_word_type: nextWord?.type ?? existing.last_word_type,
      deadline_at_micros: deadline,
    });
    return;
  }

  const firstWord = pickWordForPlayer(
    ctx,
    lobby,
    match,
    tug,
    player.player_id,
    ''
  );
  ctx.db.tug_player_state.insert({
    tug_player_state_id: id,
    match_id: match.match_id,
    player_id: player.player_id,
    current_word: firstWord.value,
    last_word_type: firstWord.type,
    correct_count: 0,
    submit_count: 0,
    last_submit_at_micros: 0n,
    deadline_at_micros: deadline,
  });
}

function assertHost(ctx: ReducerCtx<any>, lobby: LobbyRow): void {
  if (!lobby.host_identity.equals(ctx.sender)) {
    throw new Error('Only the lobby host can call this reducer');
  }
}

function getLobbySettingInt(
  ctx: ReducerCtx<any>,
  lobbyId: string,
  key: string,
  fallback: number
): number {
  const row = findFirst<InferTypeOfRow<typeof lobbySettingsRow>>(
    ctx.db.lobby_settings.iter() as Iterable<InferTypeOfRow<typeof lobbySettingsRow>>,
    item => item.setting_id === settingId(lobbyId, key)
  );
  if (!row) {
    return fallback;
  }

  const parsed = parseNumberJson(row.value_json);
  if (parsed == null) {
    return fallback;
  }

  return parsed;
}

function upsertLobbySetting(
  ctx: ReducerCtx<any>,
  lobbyId: string,
  key: string,
  valueJson: string
): void {
  const id = settingId(lobbyId, key);
  const existing = findFirst<InferTypeOfRow<typeof lobbySettingsRow>>(
    ctx.db.lobby_settings.iter() as Iterable<InferTypeOfRow<typeof lobbySettingsRow>>,
    row => row.setting_id === id
  );
  if (existing) {
    ctx.db.lobby_settings.delete(existing);
  }

  ctx.db.lobby_settings.insert({
    setting_id: id,
    lobby_id: lobbyId,
    key,
    value_json: valueJson,
  });
}

function seedDefaultLobbySettings(ctx: ReducerCtx<any>, lobbyId: string): void {
  for (const [key, value] of Object.entries(DEFAULT_LOBBY_SETTINGS)) {
    upsertLobbySetting(ctx, lobbyId, key, JSON.stringify(value));
  }
}

function removeTickSchedule(ctx: ReducerCtx<any>, matchId: string): void {
  const key = scheduleId(matchId, 'tick');
  const existing = findFirst<MatchScheduleRow>(
    ctx.db.match_schedule.iter() as Iterable<MatchScheduleRow>,
    row => row.schedule_key === key
  );
  if (existing) {
    ctx.db.match_schedule.delete(existing);
  }
}

function listPlayersInLobby(ctx: ReducerCtx<any>, lobbyId: string): PlayerRow[] {
  const players: PlayerRow[] = [];
  for (const player of ctx.db.player.iter() as Iterable<PlayerRow>) {
    if (player.lobby_id === lobbyId) {
      players.push(player);
    }
  }
  return players;
}

function countActiveByTeam(players: PlayerRow[]): { a: number; b: number } {
  let a = 0;
  let b = 0;

  for (const player of players) {
    if (player.status !== PLAYER_STATUS_ACTIVE) {
      continue;
    }
    if (player.team === TEAM_A) {
      a += 1;
    }
    if (player.team === TEAM_B) {
      b += 1;
    }
  }

  return { a, b };
}

function chooseBalancedTeam(players: PlayerRow[]): string {
  const counts = countActiveByTeam(players);
  return counts.a <= counts.b ? TEAM_A : TEAM_B;
}

function findMembershipInLobby(
  ctx: ReducerCtx<any>,
  lobbyId: string
): PlayerRow | null {
  const key = lobbyIdentityKey(lobbyId, ctx.sender);
  return findFirst<PlayerRow>(
    ctx.db.player.iter() as Iterable<PlayerRow>,
    row => row.lobby_identity_key === key
  );
}

function ensureTeamsAssigned(ctx: ReducerCtx<any>, lobbyId: string): void {
  const players = listPlayersInLobby(ctx, lobbyId).filter(
    player => player.status !== PLAYER_STATUS_LEFT
  );

  let countA = 0;
  let countB = 0;

  for (const player of players) {
    if (player.team === TEAM_A) {
      countA += 1;
    } else if (player.team === TEAM_B) {
      countB += 1;
    }
  }

  for (const player of players) {
    if (player.team === TEAM_A || player.team === TEAM_B) {
      continue;
    }

    const team = countA <= countB ? TEAM_A : TEAM_B;
    if (team === TEAM_A) {
      countA += 1;
    } else {
      countB += 1;
    }

    replaceRow(ctx.db.player, player, {
      ...player,
      team,
    });
  }
}

function resetPlayersForNewMatch(ctx: ReducerCtx<any>, lobbyId: string): void {
  for (const player of listPlayersInLobby(ctx, lobbyId)) {
    if (player.status === PLAYER_STATUS_LEFT) {
      continue;
    }

    replaceRow(ctx.db.player, player, {
      ...player,
      status: PLAYER_STATUS_ACTIVE,
      eliminated_reason: '',
      left_at_micros: 0n,
    });
  }

  ensureTeamsAssigned(ctx, lobbyId);
}

function initializeTugState(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow
): void {
  const winThreshold = getLobbySettingInt(
    ctx,
    lobby.lobby_id,
    LOBBY_SETTING_KEYS.win_threshold,
    DEFAULT_LOBBY_SETTINGS.win_threshold
  );
  const wordRotateMs = getLobbySettingInt(
    ctx,
    lobby.lobby_id,
    LOBBY_SETTING_KEYS.word_rotate_ms,
    DEFAULT_LOBBY_SETTINGS.word_rotate_ms
  );
  const eliminationWordTimeMs = getLobbySettingInt(
    ctx,
    lobby.lobby_id,
    LOBBY_SETTING_KEYS.elimination_word_time_ms,
    DEFAULT_LOBBY_SETTINGS.elimination_word_time_ms
  );
  const tieZonePercent = getLobbySettingInt(
    ctx,
    lobby.lobby_id,
    LOBBY_SETTING_KEYS.tie_zone_percent,
    DEFAULT_LOBBY_SETTINGS.tie_zone_percent
  );
  const now = nowMicros(ctx);

  const tugCurrent = getTugStateByMatchId(ctx, match.match_id);
  const firstCenterWord = pickWordForContext(ctx, {
    mode: WORD_MODE_NORMAL,
    maxDifficultyTier: 1,
    excluded: new Set<string>(),
  });
  const tugNext: TugStateRow = {
    match_id: match.match_id,
    rope_position: 0,
    win_threshold: winThreshold,
    tie_zone_percent: tieZonePercent,
    team_a_force: 0,
    team_b_force: 0,
    current_word: firstCenterWord.value,
    word_version: 1,
    mode: TUG_MODE_NORMAL,
    word_mode: WORD_MODE_NORMAL,
    ramp_tier: 1,
    difficulty_bonus_tier: 0,
    active_power_id: '',
    power_expires_at_micros: 0n,
    word_rotate_ms: wordRotateMs,
    elimination_word_time_ms: eliminationWordTimeMs,
    next_word_at_micros: now + msToMicros(wordRotateMs),
    last_tick_at_micros: now,
  };

  if (tugCurrent) {
    replaceRow(ctx.db.tug_state, tugCurrent, tugNext);
  } else {
    ctx.db.tug_state.insert(tugNext);
  }

  for (const player of listPlayersInLobby(ctx, lobby.lobby_id)) {
    if (player.status !== PLAYER_STATUS_ACTIVE) {
      continue;
    }

    const id = tugPlayerStateId(match.match_id, player.player_id);
    const existing = getTugPlayerStateById(ctx, id);
    if (existing) {
      ctx.db.tug_player_state.delete(existing);
    }

    const firstWord = pickWordForPlayer(
      ctx,
      lobby,
      match,
      tugNext,
      player.player_id,
      ''
    );
    ctx.db.tug_player_state.insert({
      tug_player_state_id: id,
      match_id: match.match_id,
      player_id: player.player_id,
      current_word: firstWord.value,
      last_word_type: firstWord.type,
      correct_count: 0,
      submit_count: 0,
      last_submit_at_micros: 0n,
      deadline_at_micros: 0n,
    });
  }

  const hostStateCurrent = getTugHostStateByMatchId(ctx, match.match_id);
  const firstHostWord = pickWordForHost(
    ctx,
    lobby,
    match,
    tugNext,
    '',
    false
  );
  const hostStateNext: TugHostStateRow = {
    match_id: match.match_id,
    host_identity: lobby.host_identity,
    score: 0,
    correct_count: 0,
    power_meter: 0,
    current_word: firstHostWord.value,
    last_word_type: firstHostWord.type,
    word_version: 1,
    last_submit_at_micros: 0n,
  };
  if (hostStateCurrent) {
    replaceRow(ctx.db.tug_host_state, hostStateCurrent, hostStateNext);
  } else {
    ctx.db.tug_host_state.insert(hostStateNext);
  }

  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'tug_initialized', {
    win_threshold: winThreshold,
    word_rotate_ms: wordRotateMs,
    elimination_word_time_ms: eliminationWordTimeMs,
  });
}

function finishMatch(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  winnerTeam: string
): void {
  if (match.phase === MATCH_PHASE_POST_GAME) {
    return;
  }

  const resolvedWinnerTeam =
    winnerTeam === TEAM_A || winnerTeam === TEAM_B ? winnerTeam : '';

  const matchNext: MatchRow = {
    ...match,
    phase: MATCH_PHASE_POST_GAME,
    ends_at_micros: nowMicros(ctx),
    winner_team: resolvedWinnerTeam,
  };
  replaceRow(ctx.db.match, match, matchNext);

  const lobbyNext: LobbyRow = {
    ...lobby,
    status: LOBBY_STATUS_FINISHED,
  };
  replaceRow(ctx.db.lobby, lobby, lobbyNext);

  removeTickSchedule(ctx, match.match_id);
  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'match_finished', {
    winner_team: resolvedWinnerTeam,
  });
}

function isValidRpsChoice(value: string): value is RpsChoice {
  return value === 'rock' || value === 'paper' || value === 'scissors';
}

interface TeamVoteCounts {
  rock: number;
  paper: number;
  scissors: number;
}

interface RpsVoteCountsByTeam {
  a: TeamVoteCounts;
  b: TeamVoteCounts;
}

function emptyTeamVoteCounts(): TeamVoteCounts {
  return { rock: 0, paper: 0, scissors: 0 };
}

function countRpsVotesByTeam(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  matchId: string
): RpsVoteCountsByTeam {
  const counts: RpsVoteCountsByTeam = {
    a: emptyTeamVoteCounts(),
    b: emptyTeamVoteCounts(),
  };
  const playersById = new Map<string, PlayerRow>();
  for (const player of listPlayersInLobby(ctx, lobby.lobby_id)) {
    playersById.set(player.player_id, player);
  }

  for (const vote of listTugRpsVotesByMatch(ctx, matchId)) {
    const player = playersById.get(vote.player_id);
    if (!player || player.status === PLAYER_STATUS_LEFT) {
      continue;
    }
    if (!isValidRpsChoice(vote.choice)) {
      continue;
    }
    if (vote.team === TEAM_A) {
      counts.a[vote.choice] += 1;
      continue;
    }
    if (vote.team === TEAM_B) {
      counts.b[vote.choice] += 1;
    }
  }

  return counts;
}

function beginRpsTieBreak(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow
): void {
  const now = nowMicros(ctx);
  const matchNext: MatchRow = {
    ...match,
    phase: MATCH_PHASE_TIE_BREAK_RPS,
  };
  replaceRow(ctx.db.match, match, matchNext);

  const lobbyNext: LobbyRow = {
    ...lobby,
    status: LOBBY_STATUS_RUNNING,
  };
  replaceRow(ctx.db.lobby, lobby, lobbyNext);

  const clock = getMatchClockByMatchId(ctx, match.match_id);
  if (clock) {
    replaceRow(ctx.db.match_clock, clock, {
      ...clock,
      phase_ends_at: new Timestamp(now + msToMicros(RPS_VOTE_SECONDS * 1000)),
      seconds_remaining: RPS_VOTE_SECONDS,
    });
  }

  clearTugRpsVotesByMatch(ctx, match.match_id);
  const current = getTugRpsStateByMatchId(ctx, match.match_id);
  const next: TugRpsStateRow = {
    match_id: match.match_id,
    round_number: 1,
    stage: RPS_STAGE_VOTING,
    voting_ends_at_micros: now + msToMicros(RPS_VOTE_SECONDS * 1000),
    team_a_choice: '',
    team_b_choice: '',
    winner_team: '',
    created_at_micros: now,
  };
  if (current) {
    replaceRow(ctx.db.tug_rps_state, current, next);
  } else {
    ctx.db.tug_rps_state.insert(next);
  }

  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'tiebreak_started', {
    tie_zone_percent: tug.tie_zone_percent,
    rope_position: tug.rope_position,
    round_number: 1,
    voting_seconds: RPS_VOTE_SECONDS,
  });
}

function maybeFinishOrStartTieBreak(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow,
  winnerTeam: string
): boolean {
  if (
    isRopeInTieZone(
      tug.rope_position,
      tug.win_threshold,
      tug.tie_zone_percent
    )
  ) {
    beginRpsTieBreak(ctx, lobby, match, tug);
    return true;
  }

  finishMatch(ctx, lobby, match, winnerTeam);
  return true;
}

function eliminatePlayer(
  ctx: ReducerCtx<any>,
  lobbyId: string,
  matchId: string,
  player: PlayerRow,
  reason: string
): void {
  if (player.status !== PLAYER_STATUS_ACTIVE) {
    return;
  }

  replaceRow(ctx.db.player, player, {
    ...player,
    status: PLAYER_STATUS_ELIMINATED,
    eliminated_reason: reason,
  });

  const tpsId = tugPlayerStateId(matchId, player.player_id);
  const playerState = getTugPlayerStateById(ctx, tpsId);
  if (playerState) {
    replaceRow(ctx.db.tug_player_state, playerState, {
      ...playerState,
      deadline_at_micros: 0n,
    });
  }

  emitGameEvent(ctx, lobbyId, matchId, 'eliminated', {
    player_id: player.player_id,
    reason,
  });
}

function transitionToSuddenDeath(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow
): { lobby: LobbyRow; match: MatchRow; tug: TugStateRow } {
  const matchNext: MatchRow = {
    ...match,
    phase: MATCH_PHASE_SUDDEN_DEATH,
  };
  replaceRow(ctx.db.match, match, matchNext);

  const lobbyNext: LobbyRow = {
    ...lobby,
    status: LOBBY_STATUS_SUDDEN_DEATH,
  };
  replaceRow(ctx.db.lobby, lobby, lobbyNext);

  const now = nowMicros(ctx);
  const tugNext: TugStateRow = {
    ...tug,
    mode: TUG_MODE_ELIMINATION,
    last_tick_at_micros: now,
  };
  replaceRow(ctx.db.tug_state, tug, tugNext);

  const deadline = now + msToMicros(tug.elimination_word_time_ms);
  for (const player of listPlayersInLobby(ctx, lobby.lobby_id)) {
    if (player.status !== PLAYER_STATUS_ACTIVE) {
      continue;
    }

    const id = tugPlayerStateId(match.match_id, player.player_id);
    const existing = getTugPlayerStateById(ctx, id);
    if (!existing) {
      continue;
    }

    replaceRow(ctx.db.tug_player_state, existing, {
      ...existing,
      deadline_at_micros: deadline,
    });
  }

  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'sudden_death_started', {});
  return { lobby: lobbyNext, match: matchNext, tug: tugNext };
}

function transitionPreGameToInGame(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  clock: MatchClockRow
): { match: MatchRow; clock: MatchClockRow } {
  const roundSeconds = getLobbySettingInt(
    ctx,
    lobby.lobby_id,
    LOBBY_SETTING_KEYS.round_seconds,
    DEFAULT_LOBBY_SETTINGS.round_seconds
  );

  const matchNext: MatchRow = {
    ...match,
    phase: MATCH_PHASE_IN_GAME,
  };
  replaceRow(ctx.db.match, match, matchNext);

  const clockNext: MatchClockRow = {
    ...clock,
    phase_ends_at: new Timestamp(
      ctx.timestamp.microsSinceUnixEpoch + msToMicros(roundSeconds * 1000)
    ),
    seconds_remaining: roundSeconds,
  };
  replaceRow(ctx.db.match_clock, clock, clockNext);

  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'countdown_finished', {
    round_seconds: roundSeconds,
  });

  return {
    match: matchNext,
    clock: clockNext,
  };
}

function getHostPowerConfig(powerId: string): HostPowerConfig | null {
  if (
    powerId === HOST_POWER_TECH_MODE_BURST ||
    powerId === HOST_POWER_SYMBOLS_MODE_BURST ||
    powerId === HOST_POWER_DIFFICULTY_UP_BURST
  ) {
    return HOST_POWER_CONFIG[powerId];
  }
  return null;
}

function computeCurrentTiers(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow
): { rampTier: WordDifficultyTier; effectiveTier: WordDifficultyTier } {
  const rampTier = deriveBaseDifficultyTier(ctx, lobby, match);
  const effectiveTier = deriveEffectiveDifficultyTier(
    rampTier,
    tug.difficulty_bonus_tier
  );
  return { rampTier, effectiveTier };
}

function updateTiersOnTugState(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow
): TugStateRow {
  const tiers = computeCurrentTiers(ctx, lobby, match, tug);
  if (tug.ramp_tier === tiers.rampTier) {
    return tug;
  }

  const tugNext: TugStateRow = {
    ...tug,
    ramp_tier: tiers.rampTier,
  };
  replaceRow(ctx.db.tug_state, tug, tugNext);
  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'difficulty_tier_changed', {
    ramp_tier: tiers.rampTier,
    effective_tier: tiers.effectiveTier,
  });
  return tugNext;
}

function rerollAllActiveWords(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow
): void {
  for (const player of listPlayersInLobby(ctx, lobby.lobby_id)) {
    if (player.status !== PLAYER_STATUS_ACTIVE) {
      continue;
    }
    const id = tugPlayerStateId(match.match_id, player.player_id);
    const playerState = getTugPlayerStateById(ctx, id);
    if (!playerState) {
      continue;
    }
    const nextWord = pickWordForPlayer(
      ctx,
      lobby,
      match,
      tug,
      player.player_id,
      playerState.last_word_type,
      true
    );
    replaceRow(ctx.db.tug_player_state, playerState, {
      ...playerState,
      current_word: nextWord.value,
      last_word_type: nextWord.type,
    });
  }

  const hostState = getTugHostStateByMatchId(ctx, match.match_id);
  if (hostState) {
    const hostWord = pickWordForHost(
      ctx,
      lobby,
      match,
      tug,
      hostState.last_word_type,
      true
    );
    replaceRow(ctx.db.tug_host_state, hostState, {
      ...hostState,
      current_word: hostWord.value,
      last_word_type: hostWord.type,
      word_version: hostState.word_version + 1,
    });
  }

  const tiers = computeCurrentTiers(ctx, lobby, match, tug);
  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'global_words_rerolled', {
    word_mode: tug.word_mode,
    ramp_tier: tiers.rampTier,
    effective_tier: tiers.effectiveTier,
  });
}

function maybeExpireTimedPower(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow,
  tug: TugStateRow,
  nowMicrosValue: bigint
): TugStateRow {
  if (
    !tug.active_power_id ||
    tug.power_expires_at_micros <= 0n ||
    nowMicrosValue < tug.power_expires_at_micros
  ) {
    return tug;
  }

  const previousPower = tug.active_power_id;
  const previousMode = tug.word_mode;
  const tugNext: TugStateRow = {
    ...tug,
    active_power_id: '',
    power_expires_at_micros: 0n,
    word_mode: WORD_MODE_NORMAL,
    difficulty_bonus_tier: 0,
  };
  replaceRow(ctx.db.tug_state, tug, tugNext);

  const tiers = computeCurrentTiers(ctx, lobby, match, tugNext);
  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'difficulty_tier_changed', {
    ramp_tier: tiers.rampTier,
    effective_tier: tiers.effectiveTier,
  });
  emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'host_power_expired', {
    power_id: previousPower,
    word_mode: tugNext.word_mode,
    ramp_tier: tiers.rampTier,
    effective_tier: tiers.effectiveTier,
  });
  if (previousMode !== tugNext.word_mode) {
    emitGameEvent(ctx, lobby.lobby_id, match.match_id, 'word_mode_changed', {
      from: previousMode,
      to: tugNext.word_mode,
    });
  }

  return tugNext;
}

function resolveWinnerFromTugState(tug: TugStateRow): string {
  return resolveWinnerFromRopePosition(tug.rope_position);
}

function runTugTick(ctx: ReducerCtx<any>, matchId: string): void {
  let match = getMatchById(ctx, matchId);
  if (!match) {
    return;
  }

  let lobby = getLobbyById(ctx, match.lobby_id);
  if (!lobby) {
    return;
  }

  let clock = getMatchClockByMatchId(ctx, matchId);
  if (!clock) {
    return;
  }

  let tug = getTugStateByMatchId(ctx, matchId);
  if (!tug) {
    return;
  }

  const now = nowMicros(ctx);
  const secondsRemaining = deriveSecondsRemaining(
    clock.phase_ends_at.microsSinceUnixEpoch,
    now
  );

  if (clock.seconds_remaining !== secondsRemaining) {
    const clockNext: MatchClockRow = {
      ...clock,
      seconds_remaining: secondsRemaining,
    };
    replaceRow(ctx.db.match_clock, clock, clockNext);
    clock = clockNext;
  }

  if (match.phase === MATCH_PHASE_PRE_GAME) {
    if (!isPhaseExpired(clock.phase_ends_at.microsSinceUnixEpoch, now)) {
      return;
    }

    const transitioned = transitionPreGameToInGame(ctx, lobby, match, clock);
    match = transitioned.match;
    clock = transitioned.clock;
    return;
  }

  if (match.phase === MATCH_PHASE_TIE_BREAK_RPS) {
    const rpsState = getTugRpsStateByMatchId(ctx, matchId);
    if (!rpsState) {
      return;
    }

    if (rpsState.stage !== RPS_STAGE_VOTING) {
      return;
    }

    if (!isPhaseExpired(rpsState.voting_ends_at_micros, now)) {
      return;
    }

    const voteCounts = countRpsVotesByTeam(ctx, lobby, matchId);
    const teamAChoice = resolveMajorityRpsChoiceFromCounts(voteCounts.a);
    const teamBChoice = resolveMajorityRpsChoiceFromCounts(voteCounts.b);
    const winnerTeam = resolveRpsWinner(teamAChoice, teamBChoice);

    if (!winnerTeam) {
      const nextRound = rpsState.round_number + 1;
      const nextVotingEndsAt = now + msToMicros(RPS_VOTE_SECONDS * 1000);
      replaceRow(ctx.db.tug_rps_state, rpsState, {
        ...rpsState,
        round_number: nextRound,
        stage: RPS_STAGE_VOTING,
        voting_ends_at_micros: nextVotingEndsAt,
        team_a_choice: '',
        team_b_choice: '',
        winner_team: '',
      });
      clearTugRpsVotesByMatch(ctx, matchId);

      const clockNext: MatchClockRow = {
        ...clock,
        phase_ends_at: new Timestamp(nextVotingEndsAt),
        seconds_remaining: RPS_VOTE_SECONDS,
      };
      replaceRow(ctx.db.match_clock, clock, clockNext);

      emitGameEvent(ctx, lobby.lobby_id, matchId, 'rps_round_revote', {
        round_number: nextRound,
        voting_seconds: RPS_VOTE_SECONDS,
      });
      return;
    }

    replaceRow(ctx.db.tug_rps_state, rpsState, {
      ...rpsState,
      stage: RPS_STAGE_REVEAL,
      voting_ends_at_micros: 0n,
      team_a_choice: teamAChoice,
      team_b_choice: teamBChoice,
      winner_team: winnerTeam,
    });

    if (clock.seconds_remaining !== 0 || clock.phase_ends_at.microsSinceUnixEpoch !== now) {
      const clockNext: MatchClockRow = {
        ...clock,
        phase_ends_at: new Timestamp(now),
        seconds_remaining: 0,
      };
      replaceRow(ctx.db.match_clock, clock, clockNext);
    }

    emitGameEvent(ctx, lobby.lobby_id, matchId, 'rps_reveal_ready', {
      round_number: rpsState.round_number,
      team_a_choice: teamAChoice,
      team_b_choice: teamBChoice,
      winner_team: winnerTeam,
    });
    return;
  }

  tug = maybeExpireTimedPower(ctx, lobby, match, tug, now);
  tug = updateTiersOnTugState(ctx, lobby, match, tug);

  if (match.phase === MATCH_PHASE_IN_GAME && secondsRemaining > 0) {
    const tugNext: TugStateRow = {
      ...tug,
      rope_position: tug.rope_position + (tug.team_a_force - tug.team_b_force),
      team_a_force: Math.floor(tug.team_a_force * 0.85),
      team_b_force: Math.floor(tug.team_b_force * 0.85),
      last_tick_at_micros: now,
    };

    replaceRow(ctx.db.tug_state, tug, tugNext);
    tug = tugNext;

    if (tug.rope_position >= tug.win_threshold) {
      maybeFinishOrStartTieBreak(ctx, lobby, match, tug, TEAM_A);
      return;
    }

    if (tug.rope_position <= -tug.win_threshold) {
      maybeFinishOrStartTieBreak(ctx, lobby, match, tug, TEAM_B);
      return;
    }
  }

  if (
    match.phase === MATCH_PHASE_IN_GAME &&
    isPhaseExpired(clock.phase_ends_at.microsSinceUnixEpoch, now)
  ) {
    const transitioned = transitionToSuddenDeath(ctx, lobby, match, tug);
    lobby = transitioned.lobby;
    match = transitioned.match;
    tug = transitioned.tug;
    tug = updateTiersOnTugState(ctx, lobby, match, tug);
  }

  if (match.phase === MATCH_PHASE_SUDDEN_DEATH) {
    for (const playerState of listTugPlayerStatesByMatch(ctx, matchId)) {
      const player = getPlayerById(ctx, playerState.player_id);
      if (!player || player.status !== PLAYER_STATUS_ACTIVE) {
        continue;
      }

      if (
        playerState.deadline_at_micros > 0n &&
        playerState.deadline_at_micros < now
      ) {
        eliminatePlayer(ctx, lobby.lobby_id, match.match_id, player, 'timeout');
      }
    }

    const teamCounts = countActiveByTeam(listPlayersInLobby(ctx, lobby.lobby_id));
    if (teamCounts.a === 0 && teamCounts.b === 0) {
      maybeFinishOrStartTieBreak(
        ctx,
        lobby,
        match,
        tug,
        resolveWinnerFromTugState(tug)
      );
      return;
    }
    if (teamCounts.a === 0 && teamCounts.b > 0) {
      maybeFinishOrStartTieBreak(ctx, lobby, match, tug, TEAM_B);
      return;
    }
    if (teamCounts.b === 0 && teamCounts.a > 0) {
      maybeFinishOrStartTieBreak(ctx, lobby, match, tug, TEAM_A);
    }
  }
}

function initGameForMatch(
  ctx: ReducerCtx<any>,
  lobby: LobbyRow,
  match: MatchRow
): void {
  if (lobby.game_type === GAME_TYPE_TUG_OF_WAR) {
    initializeTugState(ctx, lobby, match);
    return;
  }

  throw new Error(`Unsupported game type: ${lobby.game_type}`);
}

export const init = spacetimedb.init(_ctx => {});

export const create_lobby = spacetimedb.reducer(
  {
    game_type: t.string(),
    round_seconds: t.i32(),
    tie_zone_percent: t.i32(),
  },
  (ctx, { game_type, round_seconds, tie_zone_percent }) => {
    if (game_type !== GAME_TYPE_TUG_OF_WAR) {
      throw new Error(`Unsupported game type: ${game_type}`);
    }

    if (round_seconds < 60 || round_seconds > 3600) {
      throw new Error('round_seconds must be between 60 and 3600');
    }
    if (!isValidTieZonePercent(tie_zone_percent)) {
      throw new Error('tie_zone_percent must be one of 10, 20, 30, or 40');
    }

    let joinCode = '';
    for (let attempt = 0; attempt < 32; attempt++) {
      const candidate = makeJoinCode(ctx);
      if (!getLobbyByJoinCode(ctx, candidate)) {
        joinCode = candidate;
        break;
      }
    }

    if (!joinCode) {
      throw new Error('Failed to allocate unique join code');
    }

    const lobbyId = newId(ctx, 'lobby');
    ctx.db.lobby.insert({
      lobby_id: lobbyId,
      join_code: joinCode,
      host_identity: ctx.sender,
      status: LOBBY_STATUS_WAITING,
      game_type,
      active_match_id: '',
      created_at: ctx.timestamp,
    });

    seedDefaultLobbySettings(ctx, lobbyId);
    upsertLobbySetting(
      ctx,
      lobbyId,
      LOBBY_SETTING_KEYS.round_seconds,
      JSON.stringify(round_seconds)
    );
    upsertLobbySetting(
      ctx,
      lobbyId,
      LOBBY_SETTING_KEYS.tie_zone_percent,
      JSON.stringify(tie_zone_percent)
    );
    emitGameEvent(ctx, lobbyId, '', 'lobby_created', {
      join_code: joinCode,
      game_type,
      round_seconds,
      tie_zone_percent,
    });
  }
);

export const join_lobby = spacetimedb.reducer(
  {
    join_code: t.string(),
    display_name: t.string(),
  },
  (ctx, { join_code, display_name }) => {
    const lobby = getLobbyByJoinCode(ctx, join_code.toUpperCase());
    if (!lobby) {
      throw new Error('Lobby not found for join code');
    }

    const normalizedName = normalizeDisplayName(display_name);
    const membershipKey = lobbyIdentityKey(lobby.lobby_id, ctx.sender);
    const existing = findFirst<PlayerRow>(
      ctx.db.player.iter() as Iterable<PlayerRow>,
      row => row.lobby_identity_key === membershipKey
    );
    if (existing) {
      let team = existing.team;
      if (team !== TEAM_A && team !== TEAM_B) {
        team = chooseBalancedTeam(listPlayersInLobby(ctx, lobby.lobby_id));
      }

      const reconnectedPlayer: PlayerRow = {
        ...existing,
        display_name: normalizedName,
        status: PLAYER_STATUS_ACTIVE,
        team,
        left_at_micros: 0n,
        eliminated_reason: '',
      };
      replaceRow(ctx.db.player, existing, reconnectedPlayer);
      ensureTugPlayerStateForActiveMatch(ctx, lobby, reconnectedPlayer);

      emitGameEvent(ctx, lobby.lobby_id, lobby.active_match_id, 'player_reconnected', {
        player_id: existing.player_id,
      });
      return;
    }

    const team = chooseBalancedTeam(listPlayersInLobby(ctx, lobby.lobby_id));
    const playerId = newId(ctx, 'player');
    const newPlayer: PlayerRow = {
      player_id: playerId,
      lobby_id: lobby.lobby_id,
      identity: ctx.sender,
      lobby_identity_key: membershipKey,
      display_name: normalizedName,
      team,
      status: PLAYER_STATUS_ACTIVE,
      joined_at: ctx.timestamp,
      left_at_micros: 0n,
      eliminated_reason: '',
    };
    ctx.db.player.insert(newPlayer);
    ensureTugPlayerStateForActiveMatch(ctx, lobby, newPlayer);

    emitGameEvent(ctx, lobby.lobby_id, lobby.active_match_id, 'player_joined', {
      player_id: playerId,
      team,
      display_name: normalizedName,
    });
  }
);

export const leave_lobby = spacetimedb.reducer(
  { lobby_id: t.string() },
  (ctx, { lobby_id }) => {
    getLobbyOrThrow(ctx, lobby_id);
    const player = findMembershipInLobby(ctx, lobby_id);
    if (!player) {
      return;
    }

    if (player.status === PLAYER_STATUS_LEFT) {
      return;
    }

    replaceRow(ctx.db.player, player, {
      ...player,
      status: PLAYER_STATUS_LEFT,
      left_at_micros: nowMicros(ctx),
    });

    emitGameEvent(ctx, lobby_id, '', 'player_left', {
      player_id: player.player_id,
    });
  }
);

export const set_lobby_setting = spacetimedb.reducer(
  {
    lobby_id: t.string(),
    key: t.string(),
    value_json: t.string(),
  },
  (ctx, { lobby_id, key, value_json }) => {
    const lobby = getLobbyOrThrow(ctx, lobby_id);
    assertHost(ctx, lobby);

    upsertLobbySetting(ctx, lobby_id, key, value_json);
    emitGameEvent(ctx, lobby_id, lobby.active_match_id, 'setting_changed', {
      key,
      value_json,
    });
  }
);

export const start_match = spacetimedb.reducer(
  { lobby_id: t.string() },
  (ctx, { lobby_id }) => {
    const lobby = getLobbyOrThrow(ctx, lobby_id);
    assertHost(ctx, lobby);

    if (
      lobby.active_match_id &&
      (lobby.status === LOBBY_STATUS_RUNNING ||
        lobby.status === LOBBY_STATUS_SUDDEN_DEATH)
    ) {
      throw new Error('Match is already active');
    }

    resetPlayersForNewMatch(ctx, lobby_id);

    const matchId = newId(ctx, 'match');
    const roundSeconds = getLobbySettingInt(
      ctx,
      lobby_id,
      LOBBY_SETTING_KEYS.round_seconds,
      DEFAULT_LOBBY_SETTINGS.round_seconds
    );
    const tickRateMs = getLobbySettingInt(
      ctx,
      lobby_id,
      LOBBY_SETTING_KEYS.tick_rate_ms,
      DEFAULT_LOBBY_SETTINGS.tick_rate_ms
    );

    const match: MatchRow = {
      match_id: matchId,
      lobby_id,
      game_type: lobby.game_type,
      phase: MATCH_PHASE_PRE_GAME,
      started_at: ctx.timestamp,
      ends_at_micros: 0n,
      winner_team: '',
      winner_player_id: '',
      seed: ctx.random.uint32(),
    };
    ctx.db.match.insert(match);
    clearTugRpsStateForMatch(ctx, matchId);
    clearTugRpsVotesByMatch(ctx, matchId);

    ctx.db.match_clock.insert({
      match_id: matchId,
      phase_ends_at: new Timestamp(
        ctx.timestamp.microsSinceUnixEpoch + msToMicros(PRE_GAME_COUNTDOWN_SECONDS * 1000)
      ),
      seconds_remaining: PRE_GAME_COUNTDOWN_SECONDS,
      tick_rate_ms: tickRateMs,
    });

    const lobbyNext: LobbyRow = {
      ...lobby,
      active_match_id: matchId,
      status: LOBBY_STATUS_RUNNING,
    };
    replaceRow(ctx.db.lobby, lobby, lobbyNext);

    initGameForMatch(ctx, lobbyNext, match);

    removeTickSchedule(ctx, matchId);
    ctx.db.match_schedule.insert({
      scheduled_id: 0n,
      schedule_key: scheduleId(matchId, 'tick'),
      match_id: matchId,
      kind: 'tick',
      active: true,
      scheduled_at: ScheduleAt.interval(msToMicros(tickRateMs)),
    });

    emitGameEvent(ctx, lobby_id, matchId, 'match_started', {
      round_seconds: roundSeconds,
      tick_rate_ms: tickRateMs,
      game_type: lobby.game_type,
    });
    emitGameEvent(ctx, lobby_id, matchId, 'countdown_started', {
      seconds: PRE_GAME_COUNTDOWN_SECONDS,
    });
  }
);

export const end_match = spacetimedb.reducer(
  { lobby_id: t.string() },
  (ctx, { lobby_id }) => {
    const lobby = getLobbyOrThrow(ctx, lobby_id);
    assertHost(ctx, lobby);

    if (!lobby.active_match_id) {
      return;
    }

    const match = getMatchById(ctx, lobby.active_match_id);
    if (!match) {
      return;
    }

    finishMatch(ctx, lobby, match, match.winner_team);
  }
);

export const reset_lobby = spacetimedb.reducer(
  { lobby_id: t.string() },
  (ctx, { lobby_id }) => {
    const lobby = getLobbyOrThrow(ctx, lobby_id);
    assertHost(ctx, lobby);

    if (lobby.active_match_id) {
      removeTickSchedule(ctx, lobby.active_match_id);

      const tug = getTugStateByMatchId(ctx, lobby.active_match_id);
      if (tug) {
        const tieZonePercent = getLobbySettingInt(
          ctx,
          lobby_id,
          LOBBY_SETTING_KEYS.tie_zone_percent,
          DEFAULT_LOBBY_SETTINGS.tie_zone_percent
        );
        replaceRow(ctx.db.tug_state, tug, {
          ...tug,
          mode: TUG_MODE_NORMAL,
          word_mode: WORD_MODE_NORMAL,
          tie_zone_percent: tieZonePercent,
          ramp_tier: 1,
          difficulty_bonus_tier: 0,
          active_power_id: '',
          power_expires_at_micros: 0n,
        });
      }

      clearTugRpsStateForMatch(ctx, lobby.active_match_id);
      clearTugRpsVotesByMatch(ctx, lobby.active_match_id);

      const hostState = getTugHostStateByMatchId(ctx, lobby.active_match_id);
      if (hostState) {
        replaceRow(ctx.db.tug_host_state, hostState, {
          ...hostState,
          score: 0,
          correct_count: 0,
          power_meter: 0,
          last_word_type: '',
        });
      }

      for (const playerState of listTugPlayerStatesByMatch(ctx, lobby.active_match_id)) {
        replaceRow(ctx.db.tug_player_state, playerState, {
          ...playerState,
          last_word_type: '',
          deadline_at_micros: 0n,
        });
      }
    }

    replaceRow(ctx.db.lobby, lobby, {
      ...lobby,
      status: LOBBY_STATUS_WAITING,
      active_match_id: '',
    });

    for (const player of listPlayersInLobby(ctx, lobby_id)) {
      if (player.status === PLAYER_STATUS_LEFT) {
        continue;
      }

      replaceRow(ctx.db.player, player, {
        ...player,
        status: PLAYER_STATUS_ACTIVE,
        eliminated_reason: '',
        left_at_micros: 0n,
      });
    }

    emitGameEvent(ctx, lobby_id, '', 'lobby_reset', {});
  }
);

export const tug_init = spacetimedb.reducer(
  { match_id: t.string() },
  (ctx, { match_id }) => {
    const match = getMatchOrThrow(ctx, match_id);
    const lobby = getLobbyOrThrow(ctx, match.lobby_id);
    assertHost(ctx, lobby);

    initializeTugState(ctx, lobby, match);
  }
);

export const tug_record_miss = spacetimedb.reducer(
  { match_id: t.string() },
  (ctx, { match_id }) => {
    const match = getMatchOrThrow(ctx, match_id);
    if (
      match.phase !== MATCH_PHASE_IN_GAME &&
      match.phase !== MATCH_PHASE_SUDDEN_DEATH
    ) {
      return;
    }

    const lobby = getLobbyOrThrow(ctx, match.lobby_id);
    if (lobby.host_identity.equals(ctx.sender)) {
      return;
    }

    const player = findMembershipInLobby(ctx, lobby.lobby_id);
    if (!player || player.status !== PLAYER_STATUS_ACTIVE) {
      return;
    }

    const stateId = tugPlayerStateId(match_id, player.player_id);
    const playerState = getTugPlayerStateById(ctx, stateId);
    if (!playerState) {
      return;
    }

    replaceRow(ctx.db.tug_player_state, playerState, {
      ...playerState,
      submit_count: playerState.submit_count + 1,
    });
  }
);

export const tug_activate_power = spacetimedb.reducer(
  {
    match_id: t.string(),
    power_id: t.string(),
  },
  (ctx, { match_id, power_id }) => {
    const match = getMatchOrThrow(ctx, match_id);
    if (
      match.phase !== MATCH_PHASE_IN_GAME &&
      match.phase !== MATCH_PHASE_SUDDEN_DEATH
    ) {
      throw new Error('Match is not accepting power usage');
    }

    const lobby = getLobbyOrThrow(ctx, match.lobby_id);
    assertHost(ctx, lobby);

    const tug = getTugStateByMatchId(ctx, match_id);
    if (!tug) {
      throw new Error('Tug state not initialized');
    }
    const hostState = getTugHostStateByMatchId(ctx, match_id);
    if (!hostState) {
      throw new Error('Host state not initialized');
    }
    const config = getHostPowerConfig(power_id);
    if (!config) {
      emitGameEvent(ctx, lobby.lobby_id, match_id, 'host_power_rejected', {
        power_id,
        reason: 'unknown_power',
      });
      throw new Error('Unknown power id');
    }

    if (hostState.power_meter < config.cost) {
      emitGameEvent(ctx, lobby.lobby_id, match_id, 'host_power_rejected', {
        power_id,
        reason: 'insufficient_meter',
        meter_before: hostState.power_meter,
        cost: config.cost,
      });
      throw new Error('Not enough host power meter');
    }

    const meterBefore = hostState.power_meter;
    const hostStateNext: TugHostStateRow = {
      ...hostState,
      power_meter: meterBefore - config.cost,
    };
    replaceRow(ctx.db.tug_host_state, hostState, hostStateNext);

    const tiersBefore = computeCurrentTiers(ctx, lobby, match, tug);
    const modeBefore = tug.word_mode;
    const now = nowMicros(ctx);
    const tugNext: TugStateRow = {
      ...tug,
      active_power_id: config.id,
      power_expires_at_micros: now + msToMicros(config.durationMs),
      word_mode: config.wordMode ?? WORD_MODE_NORMAL,
      difficulty_bonus_tier: config.difficultyBonusTier,
    };
    replaceRow(ctx.db.tug_state, tug, tugNext);
    let tugActive = tugNext;

    tugActive = updateTiersOnTugState(ctx, lobby, match, tugActive);

    const tiersAfter = computeCurrentTiers(ctx, lobby, match, tugActive);
    if (
      tiersBefore.rampTier !== tiersAfter.rampTier ||
      tiersBefore.effectiveTier !== tiersAfter.effectiveTier
    ) {
      emitGameEvent(ctx, lobby.lobby_id, match_id, 'difficulty_tier_changed', {
        ramp_tier: tiersAfter.rampTier,
        effective_tier: tiersAfter.effectiveTier,
      });
    }
    if (modeBefore !== tugActive.word_mode) {
      emitGameEvent(ctx, lobby.lobby_id, match_id, 'word_mode_changed', {
        from: modeBefore,
        to: tugActive.word_mode,
      });
    }

    emitGameEvent(ctx, lobby.lobby_id, match_id, 'host_power_used', {
      power_id: config.id,
      meter_before: meterBefore,
      meter_after: hostStateNext.power_meter,
      word_mode: tugActive.word_mode,
      ramp_tier: tiersAfter.rampTier,
      effective_tier: tiersAfter.effectiveTier,
      duration_ms: config.durationMs,
    });

    rerollAllActiveWords(ctx, lobby, match, tugActive);
  }
);

export const tug_rps_cast_vote = spacetimedb.reducer(
  {
    match_id: t.string(),
    choice: t.string(),
  },
  (ctx, { match_id, choice }) => {
    const match = getMatchOrThrow(ctx, match_id);
    if (match.phase !== MATCH_PHASE_TIE_BREAK_RPS) {
      throw new Error('Match is not in tie-break voting');
    }

    const lobby = getLobbyOrThrow(ctx, match.lobby_id);
    if (lobby.host_identity.equals(ctx.sender)) {
      throw new Error('Host cannot vote in tie-break');
    }

    const rpsState = getTugRpsStateByMatchId(ctx, match_id);
    if (!rpsState || rpsState.stage !== RPS_STAGE_VOTING) {
      throw new Error('Tie-break voting is not open');
    }
    if (nowMicros(ctx) > rpsState.voting_ends_at_micros) {
      throw new Error('Tie-break voting is closed');
    }

    if (!isValidRpsChoice(choice)) {
      throw new Error('Invalid RPS choice');
    }

    const player = findMembershipInLobby(ctx, lobby.lobby_id);
    if (!player) {
      throw new Error('Player is not in this lobby');
    }
    if (player.status === PLAYER_STATUS_LEFT) {
      throw new Error('Left players cannot vote');
    }
    if (player.team !== TEAM_A && player.team !== TEAM_B) {
      throw new Error('Player is not on a team');
    }

    const voteId = `${match_id}:${player.player_id}`;
    const existing = findFirst<TugRpsVoteRow>(
      ctx.db.tug_rps_vote.iter() as Iterable<TugRpsVoteRow>,
      row => row.tug_rps_vote_id === voteId
    );
    const nextVote: TugRpsVoteRow = {
      tug_rps_vote_id: voteId,
      match_id,
      player_id: player.player_id,
      team: player.team,
      choice,
      submitted_at_micros: nowMicros(ctx),
    };
    if (existing) {
      replaceRow(ctx.db.tug_rps_vote, existing, nextVote);
    } else {
      ctx.db.tug_rps_vote.insert(nextVote);
    }

    emitGameEvent(ctx, lobby.lobby_id, match_id, 'rps_vote_cast', {
      round_number: rpsState.round_number,
      vote_received: true,
    });
  }
);

export const tug_rps_continue = spacetimedb.reducer(
  {
    match_id: t.string(),
  },
  (ctx, { match_id }) => {
    const match = getMatchOrThrow(ctx, match_id);
    if (match.phase !== MATCH_PHASE_TIE_BREAK_RPS) {
      throw new Error('Match is not in tie-break reveal');
    }

    const lobby = getLobbyOrThrow(ctx, match.lobby_id);
    assertHost(ctx, lobby);

    const rpsState = getTugRpsStateByMatchId(ctx, match_id);
    if (!rpsState || rpsState.stage !== RPS_STAGE_REVEAL) {
      throw new Error('Tie-break reveal is not ready');
    }
    if (rpsState.winner_team !== TEAM_A && rpsState.winner_team !== TEAM_B) {
      throw new Error('Tie-break winner is not resolved');
    }

    emitGameEvent(ctx, lobby.lobby_id, match_id, 'tiebreak_continue_to_postgame', {
      winner_team: rpsState.winner_team,
      round_number: rpsState.round_number,
    });

    finishMatch(ctx, lobby, match, rpsState.winner_team);
  }
);

export const tug_submit = spacetimedb.reducer(
  {
    match_id: t.string(),
    word_version: t.i32(),
    typed: t.string(),
  },
  (ctx, { match_id, typed }) => {
    const match = getMatchOrThrow(ctx, match_id);
    if (
      match.phase !== MATCH_PHASE_IN_GAME &&
      match.phase !== MATCH_PHASE_SUDDEN_DEATH
    ) {
      throw new Error('Match is not accepting submissions');
    }

    const lobby = getLobbyOrThrow(ctx, match.lobby_id);
    const tug = getTugStateByMatchId(ctx, match_id);
    if (!tug) {
      throw new Error('Tug state not initialized');
    }

    if (lobby.host_identity.equals(ctx.sender)) {
      const hostState = getTugHostStateByMatchId(ctx, match_id);
      if (!hostState) {
        throw new Error('Host state not initialized for this match');
      }

      const now = nowMicros(ctx);
      const nextHostWord = pickWordForHost(
        ctx,
        lobby,
        match,
        tug,
        hostState.last_word_type,
        true
      );
      const hostResult = applyHostSubmission(
        {
          score: hostState.score,
          currentWord: hostState.current_word,
          wordVersion: hostState.word_version,
          lastSubmitAtMicros: hostState.last_submit_at_micros,
        },
        typed,
        nextHostWord.value,
        now
      );
      const hostStateNext: TugHostStateRow = {
        ...hostState,
        score: hostResult.nextState.score,
        current_word: hostResult.nextState.currentWord,
        word_version: hostResult.nextState.wordVersion,
        last_submit_at_micros: hostResult.nextState.lastSubmitAtMicros,
      };

      if (hostResult.correct) {
        hostStateNext.correct_count += 1;
        hostStateNext.power_meter = Math.min(
          HOST_POWER_METER_MAX,
          hostStateNext.power_meter + 1
        );
        hostStateNext.last_word_type = nextHostWord.type;
        emitGameEvent(ctx, lobby.lobby_id, match_id, 'host_submit_ok', {
          score: hostStateNext.score,
          power_meter: hostStateNext.power_meter,
        });
      } else {
        emitGameEvent(ctx, lobby.lobby_id, match_id, 'host_submit_bad', {});
      }

      replaceRow(ctx.db.tug_host_state, hostState, hostStateNext);
      return;
    }

    const player = findMembershipInLobby(ctx, lobby.lobby_id);
    if (!player) {
      throw new Error('Player is not in this lobby');
    }

    if (player.status !== PLAYER_STATUS_ACTIVE) {
      throw new Error('Player is not active');
    }

    const stateId = tugPlayerStateId(match_id, player.player_id);
    const playerState = getTugPlayerStateById(ctx, stateId);
    if (!playerState) {
      throw new Error('Player state not initialized for this match');
    }

    const now = nowMicros(ctx);
    const correct = isCorrectWordSubmission(typed, playerState.current_word);
    const playerStateNext: TugPlayerStateRow = {
      ...playerState,
      submit_count: playerState.submit_count + 1,
      last_submit_at_micros: now,
    };

    if (!correct && shouldEliminateOnWrongSubmission(tug.mode)) {
      replaceRow(ctx.db.tug_player_state, playerState, playerStateNext);
      eliminatePlayer(ctx, lobby.lobby_id, match_id, player, 'misspelling');
      return;
    }

    if (correct) {
      const nextWord = pickWordForPlayer(
        ctx,
        lobby,
        match,
        tug,
        player.player_id,
        playerState.last_word_type,
        true
      );
      playerStateNext.correct_count += 1;
      playerStateNext.current_word = nextWord.value;
      playerStateNext.last_word_type = nextWord.type;
      if (tug.mode === TUG_MODE_ELIMINATION) {
        playerStateNext.deadline_at_micros =
          now + msToMicros(tug.elimination_word_time_ms);
      }

      const teamSubmit = applyPlayerCorrectSubmission(
        {
          teamAForce: tug.team_a_force,
          teamBForce: tug.team_b_force,
          teamAPulls: 0,
          teamBPulls: 0,
        },
        player.team
      );
      const tugNext: TugStateRow = {
        ...tug,
        team_a_force: teamSubmit.teamAForce,
        team_b_force: teamSubmit.teamBForce,
      };
      replaceRow(ctx.db.tug_state, tug, tugNext);

      emitGameEvent(ctx, lobby.lobby_id, match_id, 'submit_ok', {
        player_id: player.player_id,
        team: player.team,
      });
    } else {
      emitGameEvent(ctx, lobby.lobby_id, match_id, 'submit_bad', {
        player_id: player.player_id,
      });
    }

    replaceRow(ctx.db.tug_player_state, playerState, playerStateNext);
  }
);

export const tug_tick_scheduled = spacetimedb.reducer(
  { entry: matchScheduleRow },
  (ctx, { entry }) => {
    if (!entry.active || entry.kind !== 'tick') {
      return;
    }

    runTugTick(ctx, entry.match_id);
  }
);

export const tug_tick = spacetimedb.reducer(
  { match_id: t.string() },
  (ctx, { match_id }) => {
    runTugTick(ctx, match_id);
  }
);
