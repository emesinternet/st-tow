import type {
  NormalizedLobby,
  NormalizedMatch,
  NormalizedMatchClock,
  NormalizedPlayer,
  NormalizedTugPlayerState,
  NormalizedTugState,
  SessionSnapshot,
} from '@/data/selectors';
import { formatEventPayload } from '@/lib/format';
import type {
  ConnectionState,
  EventFeedItemViewModel,
  HostPanelViewModel,
  LobbyViewModel,
  MatchHudViewModel,
  PlayerInputViewModel,
  TeamCountViewModel,
  TeamPlayerViewModel,
  UiPhase,
  UiRole,
  UiViewModel,
} from '@/types/ui';

export interface SelectUiViewModelInput {
  connectionState: ConnectionState;
  snapshot: SessionSnapshot;
  identity: string;
  selectedLobbyId: string;
  pendingJoinCode: string;
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

function byCreatedAtDescending(a: NormalizedLobby, b: NormalizedLobby): number {
  return compareBigIntDescending(a.createdAtMicros, b.createdAtMicros);
}

function findLobby(
  snapshot: SessionSnapshot,
  identity: string,
  selectedLobbyId: string,
  pendingJoinCode: string
): NormalizedLobby | null {
  if (selectedLobbyId) {
    const selected = snapshot.lobbies.find(lobby => lobby.lobbyId === selectedLobbyId);
    if (selected) {
      return selected;
    }
  }

  if (pendingJoinCode) {
    const codeMatch = snapshot.lobbies.find(
      lobby => lobby.joinCode.toUpperCase() === pendingJoinCode.toUpperCase()
    );
    if (codeMatch) {
      return codeMatch;
    }
  }

  if (identity) {
    const hostLobby = [...snapshot.lobbies]
      .filter(lobby => lobby.hostIdentity === identity)
      .sort(byCreatedAtDescending)[0];
    if (hostLobby) {
      return hostLobby;
    }

    const memberships = snapshot.players
      .filter(player => player.identity === identity)
      .sort((a, b) => compareBigIntDescending(a.joinedAtMicros, b.joinedAtMicros));

    for (const membership of memberships) {
      const memberLobby = snapshot.lobbies.find(lobby => lobby.lobbyId === membership.lobbyId);
      if (memberLobby) {
        return memberLobby;
      }
    }
  }

  return null;
}

function buildTeamPlayerViewModel(
  players: NormalizedPlayer[],
  identity: string
): TeamPlayerViewModel[] {
  return players
    .map(player => ({
      playerId: player.playerId,
      displayName: player.displayName,
      team: player.team,
      status: player.status,
      eliminatedReason: player.eliminatedReason,
      isYou: player.identity === identity,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildTeamCounts(players: NormalizedPlayer[]): TeamCountViewModel {
  const active = players.filter(player => player.status === 'Active').length;
  const eliminated = players.filter(player => player.status === 'Eliminated').length;
  const left = players.filter(player => player.status === 'Left').length;
  return {
    active,
    eliminated,
    left,
    total: players.length,
  };
}

function deriveRole(
  lobby: NormalizedLobby | null,
  identity: string,
  myPlayer: NormalizedPlayer | null
): UiRole {
  if (!lobby) {
    return 'observer';
  }
  if (identity && lobby.hostIdentity === identity) {
    return 'host';
  }
  if (myPlayer) {
    return 'player';
  }
  return 'observer';
}

function derivePhase(lobby: NormalizedLobby | null, match: NormalizedMatch | null): UiPhase {
  if (!lobby) {
    return 'landing';
  }
  if (!match) {
    return 'lobby';
  }
  if (match.phase === 'PostGame' || lobby.status === 'Finished') {
    return 'post';
  }
  if (match.phase === 'InGame' || match.phase === 'SuddenDeath') {
    return 'match';
  }
  return 'lobby';
}

function normalizeRopePosition(ropePosition: number, winThreshold: number): number {
  if (winThreshold <= 0) {
    return 50;
  }
  const normalized = (ropePosition / winThreshold) * 50 + 50;
  return Math.max(0, Math.min(100, normalized));
}

function buildHostPanelModel(
  isHost: boolean,
  lobby: NormalizedLobby,
  match: NormalizedMatch | null
): HostPanelViewModel {
  const canStart = isHost && lobby.status === 'Waiting';
  const canReset = isHost;
  const canEndMatch = isHost && !!match && match.phase !== 'PostGame';

  let startDisabledReason: string | null = null;
  if (!isHost) {
    startDisabledReason = 'Only the host can start the match.';
  } else if (lobby.status !== 'Waiting') {
    startDisabledReason = `Lobby is ${lobby.status}.`;
  }

  const resetDisabledReason = !isHost ? 'Only the host can reset the lobby.' : null;

  let endDisabledReason: string | null = null;
  if (!isHost) {
    endDisabledReason = 'Only the host can end a match.';
  } else if (!match || match.phase === 'PostGame') {
    endDisabledReason = 'There is no active match to end.';
  }

  return {
    canStart,
    canReset,
    canEndMatch,
    startDisabledReason,
    resetDisabledReason,
    endDisabledReason,
  };
}

function buildPlayerInputModel(
  role: UiRole,
  player: NormalizedPlayer | null,
  match: NormalizedMatch | null,
  playerState: NormalizedTugPlayerState | null
): PlayerInputViewModel | null {
  if (!player) {
    if (role === 'player') {
      return {
        playerId: '',
        playerName: 'Player',
        playerStatus: 'Missing',
        eliminatedReason: '',
        currentWord: '',
        canSubmit: false,
        disabledReason: 'You are not currently in this lobby.',
        deadlineAtMicros: null,
      };
    }
    return null;
  }

  let disabledReason: string | null = null;
  if (player.status !== 'Active') {
    disabledReason =
      player.status === 'Eliminated'
        ? player.eliminatedReason
          ? `Eliminated: ${player.eliminatedReason}`
          : 'You are eliminated for this round.'
        : 'You are not active in this lobby.';
  } else if (!match) {
    disabledReason = 'Waiting for host to start the match.';
  } else if (match.phase !== 'InGame' && match.phase !== 'SuddenDeath') {
    disabledReason = 'Submissions are currently closed.';
  }

  const resolvedWord = playerState?.currentWord ?? '';

  if (!disabledReason && !resolvedWord) {
    disabledReason = 'Waiting for your next word.';
  }

  return {
    playerId: player.playerId,
    playerName: player.displayName,
    playerStatus: player.status,
    eliminatedReason: player.eliminatedReason,
    currentWord: resolvedWord,
    canSubmit: disabledReason == null,
    disabledReason,
    deadlineAtMicros:
      playerState && playerState.deadlineAtMicros > 0n ? playerState.deadlineAtMicros : null,
  };
}

function buildEventFeed(
  snapshot: SessionSnapshot,
  lobbyId: string,
  limit = 25
): EventFeedItemViewModel[] {
  return snapshot.events
    .filter(event => event.lobbyId === lobbyId)
    .sort((a, b) => compareBigIntDescending(a.atMicros, b.atMicros))
    .slice(0, limit)
    .map(event => ({
      eventId: event.eventId,
      type: event.type,
      payloadSummary: formatEventPayload(event.payloadJson),
      atMicros: event.atMicros,
    }));
}

function buildLobbyModel(
  lobby: NormalizedLobby,
  players: NormalizedPlayer[],
  identity: string
): LobbyViewModel {
  const teamAPlayers = players.filter(player => player.team === 'A');
  const teamBPlayers = players.filter(player => player.team === 'B');

  return {
    lobbyId: lobby.lobbyId,
    joinCode: lobby.joinCode,
    status: lobby.status,
    gameType: lobby.gameType,
    isHost: lobby.hostIdentity === identity,
    hostIdentity: lobby.hostIdentity,
    teamA: buildTeamPlayerViewModel(teamAPlayers, identity),
    teamB: buildTeamPlayerViewModel(teamBPlayers, identity),
    teamACounts: buildTeamCounts(teamAPlayers),
    teamBCounts: buildTeamCounts(teamBPlayers),
  };
}

function buildMatchHudModel(
  match: NormalizedMatch,
  clock: NormalizedMatchClock | null,
  tug: NormalizedTugState | null,
  teamAPlayers: NormalizedPlayer[],
  teamBPlayers: NormalizedPlayer[],
  myState: NormalizedTugPlayerState | null
): MatchHudViewModel {
  const ropePosition = tug?.ropePosition ?? 0;
  const winThreshold = tug?.winThreshold ?? 100;

  return {
    matchId: match.matchId,
    phase: match.phase,
    secondsRemaining: clock ? clock.secondsRemaining : null,
    winnerTeam: match.winnerTeam,
    ropePosition,
    normalizedRopePosition: normalizeRopePosition(ropePosition, winThreshold),
    winThreshold,
    teamAForce: tug?.teamAForce ?? 0,
    teamBForce: tug?.teamBForce ?? 0,
    aliveTeamA: teamAPlayers.filter(player => player.status === 'Active').length,
    aliveTeamB: teamBPlayers.filter(player => player.status === 'Active').length,
    currentWord: tug?.currentWord ?? '',
    wordVersion: tug?.wordVersion ?? 0,
    mode: tug?.mode ?? 'Normal',
    suddenDeathDeadlineMicros:
      myState && myState.deadlineAtMicros > 0n ? myState.deadlineAtMicros : null,
  };
}

export function selectUiViewModel(input: SelectUiViewModelInput): UiViewModel {
  const { connectionState, snapshot, identity, selectedLobbyId, pendingJoinCode } = input;

  const lobby = findLobby(snapshot, identity, selectedLobbyId, pendingJoinCode);
  if (!lobby) {
    return {
      connectionState,
      role: 'observer',
      phase: 'landing',
      lobby: null,
      matchHud: null,
      hostPanel: null,
      playerInput: null,
      events: [],
    };
  }

  const lobbyPlayers = snapshot.players.filter(player => player.lobbyId === lobby.lobbyId);
  const myPlayer = lobbyPlayers.find(player => player.identity === identity) ?? null;

  const match = lobby.activeMatchId
    ? snapshot.matches.find(item => item.matchId === lobby.activeMatchId) ?? null
    : null;

  const clock = match
    ? snapshot.clocks.find(item => item.matchId === match.matchId) ?? null
    : null;

  const tug = match
    ? snapshot.tugStates.find(item => item.matchId === match.matchId) ?? null
    : null;

  const myTugState =
    match && myPlayer
      ? snapshot.tugPlayerStates.find(
          item => item.matchId === match.matchId && item.playerId === myPlayer.playerId
        ) ?? null
      : null;

  const role = deriveRole(lobby, identity, myPlayer);
  const phase = derivePhase(lobby, match);

  const teamAPlayers = lobbyPlayers.filter(player => player.team === 'A');
  const teamBPlayers = lobbyPlayers.filter(player => player.team === 'B');

  return {
    connectionState,
    role,
    phase,
    lobby: buildLobbyModel(lobby, lobbyPlayers, identity),
    matchHud: match
      ? buildMatchHudModel(match, clock, tug, teamAPlayers, teamBPlayers, myTugState)
      : null,
    hostPanel: buildHostPanelModel(lobby.hostIdentity === identity, lobby, match),
    playerInput: buildPlayerInputModel(role, myPlayer, match, myTugState),
    events: buildEventFeed(snapshot, lobby.lobbyId),
  };
}
