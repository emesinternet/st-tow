import type {
  NormalizedLobby,
  NormalizedMatch,
  NormalizedPlayer,
  SessionSnapshot,
} from '@/data/selectors';

export interface ScopeState {
  lobbyId: string;
  matchId: string;
}

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function isSameIdentity(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  return normalizeIdentity(left) === normalizeIdentity(right);
}

function quoteSql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sortBigIntDesc(left: bigint, right: bigint): number {
  if (left > right) {
    return -1;
  }
  if (left < right) {
    return 1;
  }
  return 0;
}

function findHostLobby(snapshot: SessionSnapshot, identity: string): NormalizedLobby | null {
  const candidates = snapshot.lobbies
    .filter((lobby) => isSameIdentity(lobby.hostIdentity, identity))
    .sort((a, b) => sortBigIntDesc(a.createdAtMicros, b.createdAtMicros));
  return candidates[0] ?? null;
}

function findPlayerMembershipLobby(
  snapshot: SessionSnapshot,
  identity: string
): NormalizedLobby | null {
  const memberships: NormalizedPlayer[] = snapshot.players
    .filter((player) => player.status !== 'Left' && isSameIdentity(player.identity, identity))
    .sort((a, b) => sortBigIntDesc(a.joinedAtMicros, b.joinedAtMicros));

  for (const membership of memberships) {
    const lobby = snapshot.lobbies.find((candidate) => candidate.lobbyId === membership.lobbyId);
    if (lobby) {
      return lobby;
    }
  }
  return null;
}

function findActiveMatchForLobby(
  snapshot: SessionSnapshot,
  lobby: NormalizedLobby | null
): NormalizedMatch | null {
  if (!lobby) {
    return null;
  }
  if (lobby.activeMatchId) {
    const byActiveId = snapshot.matches.find((match) => match.matchId === lobby.activeMatchId);
    if (byActiveId) {
      return byActiveId;
    }
  }

  return (
    snapshot.matches
      .filter((match) => match.lobbyId === lobby.lobbyId)
      .sort((a, b) => sortBigIntDesc(a.startedAtMicros, b.startedAtMicros))[0] ?? null
  );
}

export function deriveScope(snapshot: SessionSnapshot, identity: string): ScopeState {
  if (!identity) {
    return { lobbyId: '', matchId: '' };
  }

  const hostLobby = findHostLobby(snapshot, identity);
  const lobby = hostLobby ?? findPlayerMembershipLobby(snapshot, identity);
  const match = findActiveMatchForLobby(snapshot, lobby);

  return {
    lobbyId: lobby?.lobbyId ?? '',
    matchId: match?.matchId ?? '',
  };
}

export function buildScopedQueries(scope: ScopeState): string[] {
  if (!scope.lobbyId) {
    return [];
  }

  const lobbyIdSql = quoteSql(scope.lobbyId);
  const queries: string[] = [
    `SELECT * FROM lobby_settings WHERE lobby_id = ${lobbyIdSql}`,
    `SELECT * FROM game_event WHERE lobby_id = ${lobbyIdSql}`,
  ];

  if (!scope.matchId) {
    return queries;
  }

  const matchIdSql = quoteSql(scope.matchId);
  queries.push(
    `SELECT * FROM match_clock WHERE match_id = ${matchIdSql}`,
    `SELECT * FROM tug_state WHERE match_id = ${matchIdSql}`,
    `SELECT * FROM tug_camera_state WHERE match_id = ${matchIdSql}`,
    `SELECT * FROM tug_webrtc_signal WHERE match_id = ${matchIdSql}`,
    `SELECT * FROM tug_rps_state WHERE match_id = ${matchIdSql}`,
    `SELECT * FROM tug_rps_vote WHERE match_id = ${matchIdSql}`,
    `SELECT * FROM tug_player_state WHERE match_id = ${matchIdSql}`,
    `SELECT * FROM tug_host_state WHERE match_id = ${matchIdSql}`
  );

  return queries;
}
