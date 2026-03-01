import * as moduleBindings from '../../../web/src/module_bindings/index.ts';
import type {
  GameEvent,
  Lobby,
  Match,
  Player,
  TugPlayerState,
  TugRpsState,
} from '../../../web/src/module_bindings/types.ts';
import { BotClient, nextDelayMs, shouldVoteInRound } from './botClient';
import { getStressUsage, parseStressConfig } from './config';
import { buildStressReport, renderStressReport, writeReportJson } from './report';
import type {
  BotMetrics,
  LiveGameEventRow,
  LiveLobbyRow,
  LiveMatchRow,
  LivePlayerRow,
  LiveRunMetrics,
  LiveSnapshot,
  LiveTugPlayerStateRow,
  LiveTugRpsStateRow,
  RpsChoice,
} from './types';

interface ControllerSession {
  connection: DbConnection;
  getSnapshot: () => LiveSnapshot;
  disconnect: () => void;
}

type SubscriptionHandle = {
  unsubscribe: () => void;
};

type TimestampLike = {
  microsSinceUnixEpoch?: bigint;
  __timestamp_micros_since_unix_epoch__?: bigint;
};

type DbConnection = {
  db: {
    lobby: { iter: () => Iterable<Lobby> };
    match: { iter: () => Iterable<Match> };
    player: { iter: () => Iterable<Player> };
    tug_player_state: { iter: () => Iterable<TugPlayerState> };
    tug_rps_state: { iter: () => Iterable<TugRpsState> };
    game_event: { iter: () => Iterable<GameEvent> };
  };
  subscriptionBuilder: () => {
    onApplied: (callback: () => void) => {
      subscribe: (queries: unknown[]) => SubscriptionHandle;
    };
    subscribe: (queries: unknown[]) => SubscriptionHandle;
  };
  disconnect: () => void;
};

type DbConnectionBuilder = {
  withUri: (uri: string) => DbConnectionBuilder;
  withDatabaseName: (databaseName: string) => DbConnectionBuilder;
  onConnect: (callback: (ctx: DbConnection) => void) => DbConnectionBuilder;
  onConnectError: (
    callback: (_ctx: unknown, error: { message: string }) => void
  ) => DbConnectionBuilder;
  build: () => DbConnection;
};

type TablesAccessor = {
  lobby: unknown;
  match: unknown;
  player: unknown;
  tug_player_state: unknown;
  tug_rps_state: unknown;
  game_event: unknown;
};

function resolveDbConnectionClass(): { builder: () => DbConnectionBuilder } {
  const bindings = moduleBindings as unknown as {
    DbConnection?: { builder?: () => DbConnectionBuilder };
    default?: { DbConnection?: { builder?: () => DbConnectionBuilder } };
  };

  const candidate = bindings.DbConnection ?? bindings.default?.DbConnection;
  if (!candidate?.builder) {
    throw new Error(
      'Unable to resolve DbConnection from web module bindings. Expected DbConnection export.'
    );
  }
  return candidate;
}

const DbConnectionClass = resolveDbConnectionClass();

function resolveTablesAccessor(): TablesAccessor {
  const bindings = moduleBindings as unknown as {
    tables?: TablesAccessor;
    default?: { tables?: TablesAccessor };
  };

  const tables = bindings.tables ?? bindings.default?.tables;
  if (!tables) {
    throw new Error('Unable to resolve tables accessor from web module bindings.');
  }
  return tables;
}

const tablesAccessor = resolveTablesAccessor();

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addPhaseDuration(metrics: LiveRunMetrics, phase: string, deltaMs: number): void {
  const current = metrics.phaseDurationsMs.get(phase) ?? 0;
  metrics.phaseDurationsMs.set(phase, current + Math.max(0, deltaMs));
}

function identityToHex(value: unknown): string {
  if (!value) {
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

function normalizeIdentityHex(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
}

function timestampToMicros(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'object' && value) {
    const timestamp = value as TimestampLike;
    if (typeof timestamp.microsSinceUnixEpoch === 'bigint') {
      return timestamp.microsSinceUnixEpoch;
    }
    if (typeof timestamp.__timestamp_micros_since_unix_epoch__ === 'bigint') {
      return timestamp.__timestamp_micros_since_unix_epoch__;
    }
  }

  return 0n;
}

function extractSnapshot(connection: DbConnection): LiveSnapshot {
  const lobbies: LiveLobbyRow[] = Array.from(connection.db.lobby.iter() as Iterable<Lobby>).map(
    (row) => ({
      lobbyId: row.lobbyId,
      joinCode: row.joinCode,
      hostIdentityHex: identityToHex(row.hostIdentity),
      status: row.status,
      gameType: row.gameType,
      activeMatchId: row.activeMatchId,
      createdAtMicros: timestampToMicros(row.createdAt),
    })
  );

  const matches: LiveMatchRow[] = Array.from(connection.db.match.iter() as Iterable<Match>).map(
    (row) => ({
      matchId: row.matchId,
      lobbyId: row.lobbyId,
      phase: row.phase,
      winnerTeam: row.winnerTeam,
    })
  );

  const players: LivePlayerRow[] = Array.from(connection.db.player.iter() as Iterable<Player>).map(
    (row) => ({
      playerId: row.playerId,
      lobbyId: row.lobbyId,
      identityHex: identityToHex(row.identity),
      displayName: row.displayName,
      status: row.status,
      team: row.team,
    })
  );

  const tugPlayerStates: LiveTugPlayerStateRow[] = Array.from(
    connection.db.tug_player_state.iter() as Iterable<TugPlayerState>
  ).map((row) => ({
    tugPlayerStateId: row.tugPlayerStateId,
    matchId: row.matchId,
    playerId: row.playerId,
    currentWord: row.currentWord,
    wordVersion: row.submitCount,
  }));

  const tugRpsStates: LiveTugRpsStateRow[] = Array.from(
    connection.db.tug_rps_state.iter() as Iterable<TugRpsState>
  ).map((row) => ({
    matchId: row.matchId,
    roundNumber: row.roundNumber,
    stage: row.stage,
  }));

  const events: LiveGameEventRow[] = Array.from(
    connection.db.game_event.iter() as Iterable<GameEvent>
  ).map((row) => ({
    eventId: row.eventId,
    lobbyId: row.lobbyId,
    matchId: row.matchId,
    type: row.type,
  }));

  return {
    lobbies,
    matches,
    players,
    tugPlayerStates,
    tugRpsStates,
    events,
    generatedAtMs: Date.now(),
  };
}

function findTargetLobby(snapshot: LiveSnapshot): LiveLobbyRow | null {
  const waitingTugLobbies = snapshot.lobbies.filter(
    (lobby) => lobby.status === 'Waiting' && lobby.gameType === 'tug_of_war'
  );

  if (!waitingTugLobbies.length) {
    return null;
  }

  waitingTugLobbies.sort((left, right) => Number(right.createdAtMicros - left.createdAtMicros));
  return waitingTugLobbies[0] ?? null;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

function pickRpsChoice(random: () => number): RpsChoice {
  const choices: RpsChoice[] = ['rock', 'paper', 'scissors'];
  const index = Math.floor(random() * choices.length) % choices.length;
  return choices[index];
}

function incrementMinuteBucket(buckets: Map<number, number>, minute: number): void {
  const current = buckets.get(minute) ?? 0;
  buckets.set(minute, current + 1);
}

interface SubmitAttemptState {
  wordVersion: number;
  wasIntentionalMistake: boolean;
}

const MUTATION_CHARSET = 'abcdefghijklmnopqrstuvwxyz{}[]()/\\-_=+*?!@#$%^&:;,.<>';

function buildMistypedSubmission(target: string, random: () => number): string {
  if (!target.length) {
    return target;
  }

  const chars = target.split('');
  const mutableIndexes = chars
    .map((char, index) => ({ char, index }))
    .filter((item) => item.char !== ' ')
    .map((item) => item.index);

  if (!mutableIndexes.length) {
    return target;
  }

  const index = mutableIndexes[Math.floor(random() * mutableIndexes.length) % mutableIndexes.length];
  const original = chars[index] ?? '';
  const replacementSource =
    MUTATION_CHARSET[Math.floor(random() * MUTATION_CHARSET.length) % MUTATION_CHARSET.length] ??
    'x';

  let replacement = replacementSource;
  if (replacement === original) {
    replacement = original === 'x' ? 'z' : 'x';
  }

  chars[index] = replacement;
  return chars.join('');
}

function estimateSubmitDelayMs(
  random: () => number,
  word: string,
  minJitterMs: number,
  maxJitterMs: number
): number {
  const jitter = nextDelayMs(random, minJitterMs, maxJitterMs);
  const perCharMs = nextDelayMs(random, 45, 95);
  const charCost = Math.min(2_500, Math.max(0, word.length) * perCharMs);
  return jitter + charCost;
}

async function connectController(host: string, dbName: string): Promise<ControllerSession> {
  return new Promise<ControllerSession>((resolve, reject) => {
    let subscription: SubscriptionHandle | null = null;
    let settled = false;

    const connection = DbConnectionClass.builder()
      .withUri(host)
      .withDatabaseName(dbName)
      .onConnect((ctx) => {
        subscription = ctx.subscriptionBuilder().subscribe([
          tablesAccessor.lobby,
          tablesAccessor.match,
          tablesAccessor.player,
          tablesAccessor.tug_player_state,
          tablesAccessor.tug_rps_state,
          tablesAccessor.game_event,
        ]);

        if (!settled) {
          settled = true;
          resolve({
            connection: ctx,
            getSnapshot: () => extractSnapshot(ctx),
            disconnect: () => {
              subscription?.unsubscribe();
              connection.disconnect();
            },
          });
        }
      })
      .onConnectError((_ctx, error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(`Controller connection failed: ${error.message}`));
      })
      .build();

    setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      connection.disconnect();
      reject(new Error('Controller connection timed out.'));
    }, 12_000);
  });
}

async function runTasksWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index], index);
    }
  });

  await Promise.all(workers);
}

function buildInitialBotMetrics(botId: string, displayName: string): BotMetrics {
  return {
    botId,
    displayName,
    identityHex: '',
    joinAttempted: false,
    joinSucceeded: false,
    joinLatencyMs: null,
    joinError: null,
    submitAttempts: 0,
    submitSuccesses: 0,
    submitErrors: 0,
    voteAttempts: 0,
    voteSuccesses: 0,
    voteErrors: 0,
    disconnects: 0,
    reconnects: 0,
  };
}

async function run(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log(getStressUsage());
    return;
  }

  const config = parseStressConfig(process.argv.slice(2));
  const random = createSeededRandom(config.seed);

  console.log('[stress] starting live stress run');
  console.log(
    `[stress] host=${config.host} db=${config.dbName} bots=${config.bots} duration_min=${config.durationMin} seed=${config.seed}`
  );

  const controller = await connectController(config.host, config.dbName);

  const runMetrics: LiveRunMetrics = {
    lobbyDetectedAtMs: null,
    matchDetectedAtMs: null,
    inGameStartedAtMs: null,
    runEndedAtMs: Date.now(),
    rpsEntered: false,
    rpsRoundsSeen: new Set<number>(),
    phaseDurationsMs: new Map<string, number>(),
    eventCounts: new Map<string, number>(),
  };

  const seenEventIds = new Set<string>();
  const submitPerMinute = new Map<number, number>();

  const waitLobbyStartedAt = Date.now();
  let targetLobby: LiveLobbyRow | null = null;
  while (!targetLobby) {
    const snapshot = controller.getSnapshot();
    targetLobby = findTargetLobby(snapshot);

    if (targetLobby) {
      break;
    }

    if (Date.now() - waitLobbyStartedAt > config.autoLobbyTimeoutSec * 1000) {
      throw new Error(
        `No Waiting tug lobby was detected within ${config.autoLobbyTimeoutSec} seconds.`
      );
    }

    await waitFor(250);
  }

  runMetrics.lobbyDetectedAtMs = Date.now();
  console.log(`[stress] target lobby detected: ${targetLobby.joinCode} (${targetLobby.lobbyId})`);

  const bots = Array.from({ length: config.bots }, (_value, index) => {
    const id = `bot-${String(index + 1).padStart(3, '0')}`;
    const name = `Bot${String(index + 1).padStart(3, '0')}`;
    return new BotClient(id, name, config.host, config.dbName);
  });
  const botRandomById = new Map<string, () => number>(
    bots.map((bot, index) => {
      const mixedSeed =
        ((config.seed >>> 0) ^
          hashString(bot.id) ^
          (((index + 1) * 2_654_435_761) >>> 0) ^
          0x9e3779b9) >>>
        0;
      return [bot.id, createSeededRandom(Math.max(1, mixedSeed))];
    })
  );
  const getBotRandom = (botId: string): (() => number) => botRandomById.get(botId) ?? random;

  const botMetricsById = new Map<string, BotMetrics>(
    bots.map((bot) => [bot.id, buildInitialBotMetrics(bot.id, bot.name)])
  );

  console.log('[stress] connecting and joining bots...');
  await runTasksWithConcurrency(bots, 24, async (bot, index) => {
    const botRandom = getBotRandom(bot.id);
    const jitter = nextDelayMs(botRandom, 5, 180);
    if (index > 0) {
      await waitFor(jitter);
    }

    const metrics = botMetricsById.get(bot.id);
    if (!metrics) {
      return;
    }

    metrics.joinAttempted = true;
    const joinStartedAt = Date.now();

    try {
      await bot.connect();
      metrics.identityHex = bot.identity;
      await bot.joinLobby(targetLobby.joinCode);
      metrics.joinSucceeded = true;
      metrics.joinLatencyMs = Date.now() - joinStartedAt;
    } catch (error) {
      metrics.joinSucceeded = false;
      metrics.joinError = error instanceof Error ? error.message : String(error);
      metrics.joinLatencyMs = Date.now() - joinStartedAt;
    }
  });

  const joinSucceeded = Array.from(botMetricsById.values()).filter(
    (bot) => bot.joinSucceeded
  ).length;
  console.log(`[stress] bots joined: ${joinSucceeded}/${config.bots}`);

  console.log('[stress] waiting for host to start match...');
  const waitMatchStartedAt = Date.now();
  let activeMatchId = '';
  let lastWaitLogAt = 0;
  while (!activeMatchId) {
    const snapshot = controller.getSnapshot();
    const lobby = snapshot.lobbies.find((entry) => entry.lobbyId === targetLobby.lobbyId) ?? null;

    if (lobby?.activeMatchId) {
      activeMatchId = lobby.activeMatchId;
      break;
    }

    const now = Date.now();
    if (now - lastWaitLogAt >= 5_000) {
      lastWaitLogAt = now;
      const lobbyStatus = lobby?.status ?? 'missing';
      const matchCount = snapshot.matches.filter((entry) => entry.lobbyId === targetLobby.lobbyId).length;
      console.log(
        `[stress] still waiting: lobby_status=${lobbyStatus} active_match_id=${lobby?.activeMatchId || '(empty)'} match_rows=${matchCount}`
      );
    }

    if (Date.now() - waitMatchStartedAt > config.autoLobbyTimeoutSec * 1000) {
      console.log('[stress] host did not start a match before timeout; finishing run early.');
      break;
    }

    await waitFor(250);
  }

  const pendingActions = new Set<Promise<void>>();
  const track = (promise: Promise<void>) => {
    pendingActions.add(promise);
    promise.finally(() => pendingActions.delete(promise)).catch(() => undefined);
  };

  const botPlayerIdByBotId = new Map<string, string>();
  const lastSubmitAttemptByBotId = new Map<string, SubmitAttemptState>();
  const nextSubmitAtByBotId = new Map<string, number>();
  const submitInFlight = new Set<string>();
  const lastVotedRoundByBotId = new Map<string, number>();
  const voteDueAtByBotId = new Map<string, number>();
  const seedSubmitOffsets = (baseNowMs: number) => {
    for (const bot of bots) {
      const botRandom = getBotRandom(bot.id);
      nextSubmitAtByBotId.set(bot.id, baseNowMs + nextDelayMs(botRandom, 200, 1600));
    }
  };
  seedSubmitOffsets(Date.now());

  let currentPhase = 'Waiting';
  let currentPhaseStartedAtMs = Date.now();
  let loopStartedAtMs = Date.now();

  if (activeMatchId) {
    runMetrics.matchDetectedAtMs = Date.now();
    loopStartedAtMs = Date.now();
    const durationMs = config.durationMin * 60 * 1000;
    let lastProgressLogAtMs = 0;

    while (Date.now() < loopStartedAtMs + durationMs) {
      const now = Date.now();
      const snapshot = controller.getSnapshot();
      const currentLobby =
        snapshot.lobbies.find((entry) => entry.lobbyId === targetLobby.lobbyId) ?? null;

      if (
        currentLobby?.activeMatchId &&
        currentLobby.activeMatchId.length > 0 &&
        currentLobby.activeMatchId !== activeMatchId
      ) {
        console.log(
          `[stress] switching active match ${activeMatchId} -> ${currentLobby.activeMatchId}`
        );
        activeMatchId = currentLobby.activeMatchId;
        botPlayerIdByBotId.clear();
        lastSubmitAttemptByBotId.clear();
        nextSubmitAtByBotId.clear();
        submitInFlight.clear();
        lastVotedRoundByBotId.clear();
        voteDueAtByBotId.clear();
        seedSubmitOffsets(now);
      }

      for (const eventRow of snapshot.events) {
        if (eventRow.lobbyId !== targetLobby.lobbyId) {
          continue;
        }
        if (seenEventIds.has(eventRow.eventId)) {
          continue;
        }

        seenEventIds.add(eventRow.eventId);
        runMetrics.eventCounts.set(
          eventRow.type,
          (runMetrics.eventCounts.get(eventRow.type) ?? 0) + 1
        );
      }

      const lobby = currentLobby;
      const match = snapshot.matches.find((entry) => entry.matchId === activeMatchId) ?? null;
      const phase = match?.phase ?? lobby?.status ?? 'Waiting';

      if (phase !== currentPhase) {
        addPhaseDuration(runMetrics, currentPhase, now - currentPhaseStartedAtMs);
        currentPhase = phase;
        currentPhaseStartedAtMs = now;
      }

      if (!runMetrics.matchDetectedAtMs && match) {
        runMetrics.matchDetectedAtMs = now;
      }

      if (!runMetrics.inGameStartedAtMs && phase === 'InGame') {
        runMetrics.inGameStartedAtMs = now;
        loopStartedAtMs = now;
        console.log('[stress] InGame detected; 10-minute run window started.');
      }

      if (phase === 'TieBreakRps') {
        runMetrics.rpsEntered = true;
      }

      const playersInLobby = snapshot.players.filter(
        (entry) => entry.lobbyId === targetLobby.lobbyId
      );
      const playersById = new Map(playersInLobby.map((entry) => [entry.playerId, entry]));
      const playersByIdentity = new Map(
        playersInLobby.map((entry) => [normalizeIdentityHex(entry.identityHex), entry])
      );

      for (const bot of bots) {
        if (botPlayerIdByBotId.has(bot.id)) {
          continue;
        }

        const botMetrics = botMetricsById.get(bot.id);
        if (!botMetrics?.joinSucceeded || !botMetrics.identityHex) {
          continue;
        }

        const player = playersByIdentity.get(normalizeIdentityHex(botMetrics.identityHex));
        if (player) {
          botPlayerIdByBotId.set(bot.id, player.playerId);
        }
      }

      if (match && (phase === 'InGame' || phase === 'SuddenDeath')) {
        const tugByPlayerId = new Map(
          snapshot.tugPlayerStates
            .filter((entry) => entry.matchId === match.matchId)
            .map((entry) => [entry.playerId, entry])
        );

        for (const bot of bots) {
          const metrics = botMetricsById.get(bot.id);
          if (!metrics?.joinSucceeded) {
            continue;
          }

          const playerId = botPlayerIdByBotId.get(bot.id);
          if (!playerId) {
            continue;
          }

          const player = playersById.get(playerId);
          if (!player || player.status !== 'Active') {
            continue;
          }

          const tugState = tugByPlayerId.get(playerId);
          if (!tugState) {
            continue;
          }

          const lastAttempt = lastSubmitAttemptByBotId.get(bot.id) ?? null;
          if (
            lastAttempt &&
            tugState.wordVersion === lastAttempt.wordVersion &&
            !lastAttempt.wasIntentionalMistake
          ) {
            continue;
          }

          if (submitInFlight.has(bot.id)) {
            continue;
          }

          const nextSubmitAt = nextSubmitAtByBotId.get(bot.id) ?? now;
          if (now < nextSubmitAt) {
            continue;
          }

          const botRandom = getBotRandom(bot.id);
          const wasIntentionalMistake = botRandom() * 100 < config.mistakeRatePct;
          const typed = wasIntentionalMistake
            ? buildMistypedSubmission(tugState.currentWord, botRandom)
            : tugState.currentWord;

          submitInFlight.add(bot.id);
          lastSubmitAttemptByBotId.set(bot.id, {
            wordVersion: tugState.wordVersion,
            wasIntentionalMistake,
          });
          nextSubmitAtByBotId.set(
            bot.id,
            now +
              estimateSubmitDelayMs(
                botRandom,
                tugState.currentWord,
                config.submitJitterMinMs,
                config.submitJitterMaxMs
              ) +
              nextDelayMs(botRandom, 40, 360)
          );
          metrics.submitAttempts += 1;

          const promise = bot
            .submitWord(match.matchId, tugState.wordVersion, typed)
            .then(() => {
              metrics.submitSuccesses += 1;
              if (runMetrics.inGameStartedAtMs != null) {
                const minute = Math.floor((Date.now() - runMetrics.inGameStartedAtMs) / 60_000) + 1;
                incrementMinuteBucket(submitPerMinute, Math.max(1, minute));
              }
            })
            .catch(() => {
              metrics.submitErrors += 1;
            })
            .finally(() => {
              submitInFlight.delete(bot.id);
            });

          track(promise);
        }
      }

      if (match) {
        const rpsState =
          snapshot.tugRpsStates.find((entry) => entry.matchId === match.matchId) ?? null;
        if (rpsState) {
          runMetrics.rpsEntered = true;
          runMetrics.rpsRoundsSeen.add(rpsState.roundNumber);

          if (rpsState.stage !== 'Voting') {
            voteDueAtByBotId.clear();
          }

          if (rpsState.stage === 'Voting') {
            for (const bot of bots) {
              const metrics = botMetricsById.get(bot.id);
              if (!metrics?.joinSucceeded) {
                continue;
              }

              const playerId = botPlayerIdByBotId.get(bot.id);
              if (!playerId) {
                continue;
              }

              const player = playersById.get(playerId);
              if (!player || player.status === 'Left') {
                continue;
              }

              const lastVotedRound = lastVotedRoundByBotId.get(bot.id) ?? 0;
              if (!shouldVoteInRound(rpsState.stage, lastVotedRound, rpsState.roundNumber)) {
                continue;
              }

              const botRandom = getBotRandom(bot.id);
              let voteDueAt = voteDueAtByBotId.get(bot.id);
              if (voteDueAt == null) {
                voteDueAt = now + nextDelayMs(botRandom, 120, 1300);
                voteDueAtByBotId.set(bot.id, voteDueAt);
              }

              if (now < voteDueAt) {
                continue;
              }

              lastVotedRoundByBotId.set(bot.id, rpsState.roundNumber);
              voteDueAtByBotId.delete(bot.id);
              metrics.voteAttempts += 1;

              const choice = pickRpsChoice(botRandom);
              const promise = bot
                .castRpsVote(match.matchId, choice)
                .then(() => {
                  metrics.voteSuccesses += 1;
                })
                .catch(() => {
                  metrics.voteErrors += 1;
                });

              track(promise);
            }
          }
        }
      }

      if (now - lastProgressLogAtMs >= 15_000) {
        lastProgressLogAtMs = now;
        const totals = Array.from(botMetricsById.values()).reduce(
          (acc, metric) => {
            acc.submits += metric.submitSuccesses;
            acc.votes += metric.voteSuccesses;
            return acc;
          },
          { submits: 0, votes: 0 }
        );
        const mappedPlayers = botPlayerIdByBotId.size;
        const activeTugPlayers =
          match && (phase === 'InGame' || phase === 'SuddenDeath')
            ? snapshot.tugPlayerStates.filter((entry) => entry.matchId === match.matchId).length
            : 0;
        console.log(
          `[stress] phase=${phase} mapped=${mappedPlayers}/${bots.length} tug_players=${activeTugPlayers} submits_ok=${totals.submits} votes_ok=${totals.votes} pending=${pendingActions.size}`
        );
      }

      await waitFor(60);
    }
  }

  await Promise.allSettled(Array.from(pendingActions));

  addPhaseDuration(runMetrics, currentPhase, Date.now() - currentPhaseStartedAtMs);
  runMetrics.runEndedAtMs = Date.now();

  for (const bot of bots) {
    const metrics = botMetricsById.get(bot.id);
    if (!metrics) {
      continue;
    }

    metrics.identityHex = metrics.identityHex || bot.identity;
    metrics.disconnects = bot.connectionStats.disconnects;
    metrics.reconnects = bot.connectionStats.reconnects;
  }

  for (const bot of bots) {
    bot.disconnect();
  }
  controller.disconnect();

  const report = buildStressReport(
    config,
    runMetrics,
    Array.from(botMetricsById.values()),
    submitPerMinute
  );

  writeReportJson(report, config.reportJsonPath);

  console.log('');
  console.log(renderStressReport(report));
  console.log('');
  console.log(`[stress] JSON report written to ${config.reportJsonPath}`);
}

run().catch((error) => {
  console.error(`[stress] run failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
