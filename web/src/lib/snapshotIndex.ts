import type {
  NormalizedLobby,
  NormalizedLobbySetting,
  NormalizedMatch,
  NormalizedMatchClock,
  NormalizedPlayer,
  NormalizedTugCameraState,
  NormalizedTugHostState,
  NormalizedTugPlayerState,
  NormalizedTugRpsState,
  NormalizedTugRpsVote,
  NormalizedTugState,
  SessionSnapshot,
} from '@/data/selectors';

interface PlayerMembership {
  lobbyId: string;
  joinedAtMicros: bigint;
}

export interface SnapshotIndex {
  lobbyById: Map<string, NormalizedLobby>;
  lobbiesSortedByCreatedAtDesc: NormalizedLobby[];
  hostLobbiesByIdentity: Map<string, NormalizedLobby[]>;
  lobbySettingsByLobbyId: Map<string, NormalizedLobbySetting[]>;
  playersByLobbyId: Map<string, NormalizedPlayer[]>;
  nonLeftMembershipsByIdentity: Map<string, PlayerMembership[]>;
  myPlayerByLobbyIdAndIdentity: Map<string, Map<string, NormalizedPlayer>>;
  matchById: Map<string, NormalizedMatch>;
  clockByMatchId: Map<string, NormalizedMatchClock>;
  tugStateByMatchId: Map<string, NormalizedTugState>;
  tugRpsStateByMatchId: Map<string, NormalizedTugRpsState>;
  tugRpsVotesByMatchId: Map<string, NormalizedTugRpsVote[]>;
  tugPlayerStatesByMatchId: Map<string, NormalizedTugPlayerState[]>;
  tugHostStateByMatchId: Map<string, NormalizedTugHostState>;
  tugCameraStateByMatchId: Map<string, NormalizedTugCameraState>;
}

interface SnapshotIndexCacheEntry {
  signature: string;
  index: SnapshotIndex;
}

const snapshotIndexCache = new WeakMap<SessionSnapshot, SnapshotIndexCacheEntry>();

function buildSnapshotSignature(snapshot: SessionSnapshot): string {
  return [
    snapshot.generatedAt,
    snapshot.lobbies.length,
    snapshot.lobbySettings.length,
    snapshot.players.length,
    snapshot.matches.length,
    snapshot.clocks.length,
    snapshot.tugStates.length,
    snapshot.tugCameraStates.length,
    snapshot.tugRpsStates.length,
    snapshot.tugRpsVotes.length,
    snapshot.tugPlayerStates.length,
    snapshot.tugHostStates.length,
    snapshot.events.length,
  ].join(':');
}

function normalizeIdentity(identity: string): string {
  return identity.trim().toLowerCase();
}

function compareBigIntDescending(a: bigint, b: bigint): number {
  if (a > b) {
    return -1;
  }
  if (a < b) {
    return 1;
  }
  return 0;
}

function pushMapValue<T>(map: Map<string, T[]>, key: string, value: T) {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

export function buildSnapshotIndex(snapshot: SessionSnapshot): SnapshotIndex {
  const signature = buildSnapshotSignature(snapshot);
  const cached = snapshotIndexCache.get(snapshot);
  if (cached && cached.signature === signature) {
    return cached.index;
  }

  const lobbyById = new Map(snapshot.lobbies.map((lobby) => [lobby.lobbyId, lobby] as const));
  const lobbiesSortedByCreatedAtDesc = [...snapshot.lobbies].sort((left, right) =>
    compareBigIntDescending(left.createdAtMicros, right.createdAtMicros)
  );

  const hostLobbiesByIdentity = new Map<string, NormalizedLobby[]>();
  for (const lobby of lobbiesSortedByCreatedAtDesc) {
    pushMapValue(hostLobbiesByIdentity, normalizeIdentity(lobby.hostIdentity), lobby);
  }

  const lobbySettingsByLobbyId = new Map<string, NormalizedLobbySetting[]>();
  for (const setting of snapshot.lobbySettings) {
    pushMapValue(lobbySettingsByLobbyId, setting.lobbyId, setting);
  }

  const playersByLobbyId = new Map<string, NormalizedPlayer[]>();
  const nonLeftMembershipsByIdentity = new Map<string, PlayerMembership[]>();
  const myPlayerByLobbyIdAndIdentity = new Map<string, Map<string, NormalizedPlayer>>();
  for (const player of snapshot.players) {
    pushMapValue(playersByLobbyId, player.lobbyId, player);
    if (player.status !== 'Left') {
      pushMapValue(nonLeftMembershipsByIdentity, normalizeIdentity(player.identity), {
        lobbyId: player.lobbyId,
        joinedAtMicros: player.joinedAtMicros,
      });

      let byIdentity = myPlayerByLobbyIdAndIdentity.get(player.lobbyId);
      if (!byIdentity) {
        byIdentity = new Map<string, NormalizedPlayer>();
        myPlayerByLobbyIdAndIdentity.set(player.lobbyId, byIdentity);
      }
      byIdentity.set(normalizeIdentity(player.identity), player);
    }
  }
  for (const memberships of nonLeftMembershipsByIdentity.values()) {
    memberships.sort((left, right) => compareBigIntDescending(left.joinedAtMicros, right.joinedAtMicros));
  }

  const matchById = new Map(snapshot.matches.map((match) => [match.matchId, match] as const));
  const clockByMatchId = new Map(snapshot.clocks.map((clock) => [clock.matchId, clock] as const));
  const tugStateByMatchId = new Map(
    snapshot.tugStates.map((state) => [state.matchId, state] as const)
  );
  const tugRpsStateByMatchId = new Map(
    snapshot.tugRpsStates.map((state) => [state.matchId, state] as const)
  );

  const tugRpsVotesByMatchId = new Map<string, NormalizedTugRpsVote[]>();
  for (const vote of snapshot.tugRpsVotes) {
    pushMapValue(tugRpsVotesByMatchId, vote.matchId, vote);
  }

  const tugPlayerStatesByMatchId = new Map<string, NormalizedTugPlayerState[]>();
  for (const state of snapshot.tugPlayerStates) {
    pushMapValue(tugPlayerStatesByMatchId, state.matchId, state);
  }

  const tugHostStateByMatchId = new Map(
    snapshot.tugHostStates.map((state) => [state.matchId, state] as const)
  );
  const tugCameraStateByMatchId = new Map(
    snapshot.tugCameraStates.map((state) => [state.matchId, state] as const)
  );

  const index: SnapshotIndex = {
    lobbyById,
    lobbiesSortedByCreatedAtDesc,
    hostLobbiesByIdentity,
    lobbySettingsByLobbyId,
    playersByLobbyId,
    nonLeftMembershipsByIdentity,
    myPlayerByLobbyIdAndIdentity,
    matchById,
    clockByMatchId,
    tugStateByMatchId,
    tugRpsStateByMatchId,
    tugRpsVotesByMatchId,
    tugPlayerStatesByMatchId,
    tugHostStateByMatchId,
    tugCameraStateByMatchId,
  };

  snapshotIndexCache.set(snapshot, {
    signature,
    index,
  });
  return index;
}
