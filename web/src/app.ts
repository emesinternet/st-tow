import { DbConnection, tables, type ErrorContext } from './module_bindings';
import { renderTugOfWarPanel } from './ui/games/tug_of_war';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'st-tow';

const statusEl = document.getElementById('status') as HTMLDivElement;
const displayNameInput = document.getElementById('display-name') as HTMLInputElement;
const joinCodeInput = document.getElementById('join-code') as HTMLInputElement;
const joinBtn = document.getElementById('join-btn') as HTMLButtonElement;
const hostBtn = document.getElementById('host-btn') as HTMLButtonElement;
const lobbyCard = document.getElementById('lobby-card') as HTMLElement;
const lobbyCodeEl = document.getElementById('lobby-code') as HTMLElement;
const lobbyStatusEl = document.getElementById('lobby-status') as HTMLElement;
const teamAList = document.getElementById('team-a-list') as HTMLElement;
const teamBList = document.getElementById('team-b-list') as HTMLElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const matchCard = document.getElementById('match-card') as HTMLElement;
const matchPhaseEl = document.getElementById('match-phase') as HTMLElement;
const matchTimerEl = document.getElementById('match-timer') as HTMLElement;
const tugPanel = document.getElementById('tug-panel') as HTMLElement;
const submitForm = document.getElementById('submit-form') as HTMLFormElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const wordInput = document.getElementById('word-input') as HTMLInputElement;
const playerStatusEl = document.getElementById('player-status') as HTMLElement;
const eventFeedEl = document.getElementById('event-feed') as HTMLElement;

let myIdentity = '';
let currentLobbyId = '';
let pendingJoinCode = '';

function field<T = any>(row: any, camel: string, snake: string): T | undefined {
  return (row?.[camel] ?? row?.[snake]) as T | undefined;
}

function toIdentityHex(value: any): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value.toHexString === 'function') {
    return value.toHexString();
  }
  return String(value);
}

function reducerCandidates(name: string): string[] {
  return [name, snakeToCamel(name)];
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());
}

function microsValue(timestampLike: any): bigint {
  if (!timestampLike) {
    return 0n;
  }
  if (typeof timestampLike === 'bigint') {
    return timestampLike;
  }
  if (typeof timestampLike.microsSinceUnixEpoch === 'bigint') {
    return timestampLike.microsSinceUnixEpoch;
  }
  if (typeof timestampLike.__timestamp_micros_since_unix_epoch__ === 'bigint') {
    return timestampLike.__timestamp_micros_since_unix_epoch__;
  }
  return 0n;
}

function tableRows(conn: DbConnection, names: string[]): any[] {
  for (const name of names) {
    const table = (conn.db as any)[name];
    if (table && typeof table.iter === 'function') {
      return Array.from(table.iter());
    }
  }
  return [];
}

function callReducer(conn: DbConnection, reducerName: string, args: Record<string, any>): void {
  for (const candidate of reducerCandidates(reducerName)) {
    const reducer = (conn.reducers as any)[candidate];
    if (typeof reducer === 'function') {
      reducer(args);
      return;
    }
  }
  throw new Error(`Reducer not found: ${reducerName}`);
}

function renderRow(label: string, players: any[]): string {
  if (players.length === 0) {
    return `<li class="muted">No ${label} players</li>`;
  }

  return players
    .map((player) => {
      const status = player.status ?? 'Unknown';
      return `<li>${escapeHtml(player.display_name ?? 'Player')} <span class="muted">(${escapeHtml(status)})</span></li>`;
    })
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const conn = DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .withToken(localStorage.getItem('auth_token') || undefined)
  .onConnect((connection: DbConnection, identity: { toHexString: () => string }, token: string) => {
    localStorage.setItem('auth_token', token);
    myIdentity = identity.toHexString();

    statusEl.textContent = 'Connected';
    statusEl.classList.remove('bad');
    statusEl.classList.add('ok');

    connection
      .subscriptionBuilder()
      .onApplied(() => render(connection))
      .subscribe([
        tables.lobby,
        tables.player,
        tables.match,
        tables.match_clock,
        tables.tug_state,
        tables.tug_player_state,
        tables.game_event,
        tables.lobby_settings,
      ]);

    for (const table of Object.values(connection.db as Record<string, any>)) {
      table?.onInsert?.(() => render(connection));
      table?.onDelete?.(() => render(connection));
      table?.onUpdate?.(() => render(connection));
    }

    render(connection);
  })
  .onDisconnect(() => {
    statusEl.textContent = 'Disconnected';
    statusEl.classList.remove('ok');
    statusEl.classList.add('bad');
  })
  .onConnectError((_ctx: ErrorContext, error: Error) => {
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.classList.remove('ok');
    statusEl.classList.add('bad');
    console.error(error);
  })
  .build();

function render(connection: DbConnection): void {
  const lobbies = tableRows(connection, ['lobby']);
  const players = tableRows(connection, ['player']);
  const matches = tableRows(connection, ['match']);
  const clocks = tableRows(connection, ['match_clock', 'matchClock']);
  const tugStates = tableRows(connection, ['tug_state', 'tugState']);
  const events = tableRows(connection, ['game_event', 'gameEvent']);

  let lobby = currentLobbyId
    ? lobbies.find((row) => field<string>(row, 'lobbyId', 'lobby_id') === currentLobbyId)
    : undefined;

  if (!lobby && pendingJoinCode) {
    lobby = lobbies.find((row) => field<string>(row, 'joinCode', 'join_code') === pendingJoinCode);
    if (lobby) {
      currentLobbyId = field<string>(lobby, 'lobbyId', 'lobby_id') ?? '';
    }
  }

  if (!lobby && myIdentity) {
    const hostLobbies = lobbies
      .filter((row) => toIdentityHex(field(row, 'hostIdentity', 'host_identity')) === myIdentity)
      .sort((a, b) => Number(microsValue(field(b, 'createdAt', 'created_at')) - microsValue(field(a, 'createdAt', 'created_at'))));
    if (hostLobbies.length > 0) {
      lobby = hostLobbies[0];
      currentLobbyId = field<string>(lobby, 'lobbyId', 'lobby_id') ?? '';
      pendingJoinCode = field<string>(lobby, 'joinCode', 'join_code') ?? '';
    }
  }

  if (!lobby) {
    lobbyCard.hidden = true;
    matchCard.hidden = true;
    startBtn.disabled = true;
    resetBtn.disabled = true;
    submitBtn.disabled = true;
    return;
  }

  const lobbyId = field<string>(lobby, 'lobbyId', 'lobby_id') ?? '';
  const lobbyPlayers = players.filter((row) => field<string>(row, 'lobbyId', 'lobby_id') === lobbyId);
  const teamAPlayers = lobbyPlayers.filter((row) => field<string>(row, 'team', 'team') === 'A');
  const teamBPlayers = lobbyPlayers.filter((row) => field<string>(row, 'team', 'team') === 'B');
  const myPlayer = lobbyPlayers.find((row) => toIdentityHex(field(row, 'identity', 'identity')) === myIdentity);
  const isHost = toIdentityHex(field(lobby, 'hostIdentity', 'host_identity')) === myIdentity;

  lobbyCard.hidden = false;
  lobbyCodeEl.textContent = field<string>(lobby, 'joinCode', 'join_code') ?? '-';
  lobbyStatusEl.textContent = field<string>(lobby, 'status', 'status') ?? '-';
  teamAList.innerHTML = renderRow('team A', teamAPlayers);
  teamBList.innerHTML = renderRow('team B', teamBPlayers);
  startBtn.disabled = !isHost || field<string>(lobby, 'status', 'status') !== 'Waiting';
  resetBtn.disabled = !isHost;

  const activeMatchId = field<string>(lobby, 'activeMatchId', 'active_match_id');
  const match = activeMatchId
    ? matches.find((row) => field<string>(row, 'matchId', 'match_id') === activeMatchId)
    : undefined;

  if (!match) {
    matchCard.hidden = true;
    submitBtn.disabled = true;
    return;
  }

  const matchId = field<string>(match, 'matchId', 'match_id') ?? '';
  const clock = clocks.find((row) => field<string>(row, 'matchId', 'match_id') === matchId);
  const tug = tugStates.find((row) => field<string>(row, 'matchId', 'match_id') === matchId);

  matchCard.hidden = false;
  matchPhaseEl.textContent = field<string>(match, 'phase', 'phase') ?? '-';
  matchTimerEl.textContent = String(field<number>(clock, 'secondsRemaining', 'seconds_remaining') ?? '-');

  if (tug) {
    const aliveA = teamAPlayers.filter((row) => field<string>(row, 'status', 'status') === 'Active').length;
    const aliveB = teamBPlayers.filter((row) => field<string>(row, 'status', 'status') === 'Active').length;
    tugPanel.innerHTML = renderTugOfWarPanel({
      ropePosition: field<number>(tug, 'ropePosition', 'rope_position') ?? 0,
      winThreshold: field<number>(tug, 'winThreshold', 'win_threshold') ?? 100,
      teamAForce: field<number>(tug, 'teamAForce', 'team_a_force') ?? 0,
      teamBForce: field<number>(tug, 'teamBForce', 'team_b_force') ?? 0,
      currentWord: field<string>(tug, 'currentWord', 'current_word') ?? '',
      wordVersion: field<number>(tug, 'wordVersion', 'word_version') ?? 0,
      mode: field<string>(tug, 'mode', 'mode') ?? 'Normal',
      aliveTeamA: aliveA,
      aliveTeamB: aliveB,
    });
  } else {
    tugPanel.innerHTML = '<p class="muted">Waiting for tug state...</p>';
  }

  const myStatus = myPlayer
    ? `${field<string>(myPlayer, 'displayName', 'display_name') ?? 'Player'} • ${field<string>(myPlayer, 'status', 'status') ?? 'Unknown'}${field<string>(myPlayer, 'eliminatedReason', 'eliminated_reason') ? ` (${field<string>(myPlayer, 'eliminatedReason', 'eliminated_reason')})` : ''}`
    : 'Join this lobby to play';
  playerStatusEl.textContent = myStatus;
  submitBtn.disabled = !myPlayer || field<string>(myPlayer, 'status', 'status') !== 'Active' || !tug;

  const sortedEvents = [...events]
    .filter((row) => field<string>(row, 'lobbyId', 'lobby_id') === lobbyId)
    .sort((a, b) => Number(microsValue(field(b, 'at', 'at')) - microsValue(field(a, 'at', 'at'))))
    .slice(0, 20);

  eventFeedEl.textContent =
    sortedEvents.length === 0
      ? 'No events yet.'
      : sortedEvents
          .map((row) => `${field<string>(row, 'type', 'type') ?? ''} ${field<string>(row, 'payloadJson', 'payload_json') ?? ''}`)
          .join('\n');
}

hostBtn.addEventListener('click', () => {
  try {
    pendingJoinCode = '';
    callReducer(conn, 'create_lobby', {
      gameType: 'tug_of_war',
    });
  } catch (error) {
    console.error(error);
  }
});

joinBtn.addEventListener('click', () => {
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) {
    return;
  }

  const displayName = displayNameInput.value.trim() || 'Player';
  pendingJoinCode = code;

  try {
    callReducer(conn, 'join_lobby', {
      joinCode: code,
      displayName,
    });
  } catch (error) {
    console.error(error);
  }
});

startBtn.addEventListener('click', () => {
  if (!currentLobbyId) {
    return;
  }

  try {
    callReducer(conn, 'start_match', {
      lobbyId: currentLobbyId,
    });
  } catch (error) {
    console.error(error);
  }
});

resetBtn.addEventListener('click', () => {
  if (!currentLobbyId) {
    return;
  }

  try {
    callReducer(conn, 'reset_lobby', {
      lobbyId: currentLobbyId,
    });
  } catch (error) {
    console.error(error);
  }
});

submitForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const word = wordInput.value.trim();
  if (!word || !currentLobbyId) {
    return;
  }

  const lobbies = tableRows(conn, ['lobby']);
  const matches = tableRows(conn, ['match']);
  const tugStates = tableRows(conn, ['tug_state', 'tugState']);
  const lobby = lobbies.find((row) => field<string>(row, 'lobbyId', 'lobby_id') === currentLobbyId);
  const activeMatchId = field<string>(lobby, 'activeMatchId', 'active_match_id');
  if (!lobby || !activeMatchId) {
    return;
  }

  const match = matches.find((row) => field<string>(row, 'matchId', 'match_id') === activeMatchId);
  const tug = tugStates.find((row) => field<string>(row, 'matchId', 'match_id') === activeMatchId);
  if (!match || !tug) {
    return;
  }

  try {
    callReducer(conn, 'tug_submit', {
      matchId: field<string>(match, 'matchId', 'match_id'),
      wordVersion: field<number>(tug, 'wordVersion', 'word_version'),
      typed: word,
    });
    wordInput.value = '';
  } catch (error) {
    console.error(error);
  }
});

render(conn);
