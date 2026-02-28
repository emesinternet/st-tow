import type {
  NormalizedLobby,
  NormalizedLobbySetting,
  NormalizedMatch,
  NormalizedMatchClock,
  NormalizedPlayer,
  NormalizedTugHostState,
  NormalizedTugPlayerState,
  NormalizedTugRpsState,
  NormalizedTugRpsVote,
  NormalizedTugState,
  SessionSnapshot,
} from '@/data/selectors';
import { formatEventPayload } from '@/lib/format';
import type {
  ConnectionState,
  EventFeedItemViewModel,
  HostPowerActionViewModel,
  HostPanelViewModel,
  LobbyViewModel,
  MatchHudViewModel,
  PlayerInputViewModel,
  RpsTieBreakViewModel,
  TeamCountViewModel,
  TeamPlayerViewModel,
  UiPhase,
  UiRole,
  UiViewModel,
} from '@/types/ui';

const DEFAULT_ROUND_SECONDS = 90;
const MATCH_PHASE_TIE_BREAK_RPS = 'TieBreakRps';
const HOST_POWER_SPECS: Array<{ id: string; label: string; cost: number }> = [
  { id: 'tech_mode_burst', label: 'Tech Burst', cost: 1 },
  { id: 'symbols_mode_burst', label: 'Symbols Burst', cost: 1 },
  { id: 'difficulty_up_burst', label: 'Difficulty Up', cost: 1 },
];

export interface SelectUiViewModelInput {
  connectionState: ConnectionState;
  snapshot: SessionSnapshot;
  identity: string;
  selectedLobbyId: string;
  pendingJoinCode: string;
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

function parseSettingInt(valueJson: string): number | null {
  try {
    const parsed = JSON.parse(valueJson);
    const number = Number(parsed);
    return Number.isFinite(number) ? Math.trunc(number) : null;
  } catch {
    const number = Number(valueJson);
    return Number.isFinite(number) ? Math.trunc(number) : null;
  }
}

function getLobbySettingInt(
  settings: NormalizedLobbySetting[],
  lobbyId: string,
  key: string,
  fallback: number
): number {
  const row = settings.find(item => item.lobbyId === lobbyId && item.key === key);
  if (!row) {
    return fallback;
  }
  return parseSettingInt(row.valueJson) ?? fallback;
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
      .filter(lobby => isSameIdentity(lobby.hostIdentity, identity))
      .sort(byCreatedAtDescending)[0];
    if (hostLobby) {
      return hostLobby;
    }

    const memberships = snapshot.players
      .filter(player => isSameIdentity(player.identity, identity))
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
  identity: string,
  playerStateByPlayerId: Map<string, NormalizedTugPlayerState>
): TeamPlayerViewModel[] {
  return players
    .map(player => {
      const playerState = playerStateByPlayerId.get(player.playerId);
      const correctCount = playerState?.correctCount ?? 0;
      const submitCount = playerState?.submitCount ?? 0;
      const accuracy = submitCount > 0 ? Math.round((correctCount / submitCount) * 100) : 0;

      return {
        playerId: player.playerId,
        displayName: player.displayName,
        team: player.team,
        status: player.status,
        correctCount,
        submitCount,
        accuracy,
        eliminatedReason: player.eliminatedReason,
        isYou: isSameIdentity(player.identity, identity),
      };
    })
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
  if (identity && isSameIdentity(lobby.hostIdentity, identity)) {
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
  if (
    match.phase === 'PreGame' ||
    match.phase === 'InGame' ||
    match.phase === 'SuddenDeath' ||
    match.phase === MATCH_PHASE_TIE_BREAK_RPS
  ) {
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

function normalizeTieZoneBounds(
  winThreshold: number,
  tieZonePercent: number
): { start: number; end: number } {
  if (winThreshold <= 0) {
    return { start: 50, end: 50 };
  }
  const clampedPercent = Math.max(0, Math.min(100, tieZonePercent));
  const tieWindow = (winThreshold * clampedPercent) / 100;
  return {
    start: normalizeRopePosition(-tieWindow, winThreshold),
    end: normalizeRopePosition(tieWindow, winThreshold),
  };
}

function buildHostPanelModel(
  isHost: boolean,
  lobby: NormalizedLobby,
  match: NormalizedMatch | null,
  hostState: NormalizedTugHostState | null
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

  const powers: HostPowerActionViewModel[] = HOST_POWER_SPECS.map(spec => {
    if (!isHost) {
      return {
        id: spec.id,
        label: spec.label,
        cost: spec.cost,
        enabled: false,
        disabledReason: 'Only the host can trigger powers.',
      };
    }
    if (!match || (match.phase !== 'InGame' && match.phase !== 'SuddenDeath')) {
      return {
        id: spec.id,
        label: spec.label,
        cost: spec.cost,
        enabled: false,
        disabledReason: 'Powers are only available during an active match.',
      };
    }
    const meter = hostState?.powerMeter ?? 0;
    if (meter < spec.cost) {
      return {
        id: spec.id,
        label: spec.label,
        cost: spec.cost,
        enabled: false,
        disabledReason: `Need ${spec.cost} power.`,
      };
    }
    return {
      id: spec.id,
      label: spec.label,
      cost: spec.cost,
      enabled: true,
      disabledReason: null,
    };
  });

  return {
    canStart,
    canReset,
    canEndMatch,
    startDisabledReason,
    resetDisabledReason,
    endDisabledReason,
    powers,
  };
}

function buildHostInputModel(
  player: NormalizedPlayer | null,
  match: NormalizedMatch | null,
  hostState: NormalizedTugHostState | null
): PlayerInputViewModel {
  let disabledReason: string | null = null;
  if (!match) {
    disabledReason = 'Waiting for host to start the match.';
  } else if (match.phase !== 'InGame' && match.phase !== 'SuddenDeath') {
    disabledReason = 'Submissions are currently closed.';
  }

  const resolvedWord = hostState?.currentWord ?? '';
  if (!disabledReason && !resolvedWord) {
    disabledReason = 'Waiting for your next word.';
  }

  return {
    playerId: player?.playerId ?? 'host',
    playerName: player?.displayName ?? 'Host',
    playerStatus: 'Host',
    eliminatedReason: '',
    currentWord: resolvedWord,
    canSubmit: disabledReason == null,
    disabledReason,
    deadlineAtMicros: null,
  };
}

function buildPlayerInputModel(
  role: UiRole,
  player: NormalizedPlayer | null,
  match: NormalizedMatch | null,
  playerState: NormalizedTugPlayerState | null,
  hostState: NormalizedTugHostState | null
): PlayerInputViewModel | null {
  if (role === 'host') {
    return buildHostInputModel(player, match, hostState);
  }

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

function isRpsChoice(value: string): value is 'rock' | 'paper' | 'scissors' {
  return value === 'rock' || value === 'paper' || value === 'scissors';
}

function buildRpsTieBreakModel(
  role: UiRole,
  match: NormalizedMatch | null,
  rpsState: NormalizedTugRpsState | null,
  rpsVotes: NormalizedTugRpsVote[],
  myPlayer: NormalizedPlayer | null,
  snapshotGeneratedAt: number
): RpsTieBreakViewModel | null {
  if (!match || match.phase !== MATCH_PHASE_TIE_BREAK_RPS || !rpsState) {
    return null;
  }
  if (rpsState.stage !== 'Voting' && rpsState.stage !== 'Reveal') {
    return null;
  }

  const countsA = { rock: 0, paper: 0, scissors: 0 };
  const countsB = { rock: 0, paper: 0, scissors: 0 };
  for (const vote of rpsVotes) {
    if (!isRpsChoice(vote.choice)) {
      continue;
    }
    if (vote.team === 'A') {
      countsA[vote.choice] += 1;
      continue;
    }
    if (vote.team === 'B') {
      countsB[vote.choice] += 1;
    }
  }

  const myTeam = myPlayer?.team === 'A' || myPlayer?.team === 'B' ? myPlayer.team : '';
  const myVote = myPlayer
    ? rpsVotes.find(vote => vote.playerId === myPlayer.playerId)
    : null;
  const myVoteChoice = myVote && isRpsChoice(myVote.choice) ? myVote.choice : '';

  const nowMicros = BigInt(Math.trunc(snapshotGeneratedAt)) * 1000n;
  const remainingMicros =
    rpsState.votingEndsAtMicros > nowMicros ? rpsState.votingEndsAtMicros - nowMicros : 0n;
  const secondsRemaining =
    rpsState.stage === 'Voting'
      ? Math.max(0, Math.ceil(Number(remainingMicros) / 1_000_000))
      : 0;

  let myTeamCounts: RpsTieBreakViewModel['myTeamCounts'] = null;
  let opponentTeamCounts: RpsTieBreakViewModel['opponentTeamCounts'] = null;
  if (rpsState.stage === 'Voting') {
    if (role === 'player' && myTeam === 'A') {
      myTeamCounts = countsA;
    } else if (role === 'player' && myTeam === 'B') {
      myTeamCounts = countsB;
    }
  } else {
    if (myTeam === 'A') {
      myTeamCounts = countsA;
      opponentTeamCounts = countsB;
    } else if (myTeam === 'B') {
      myTeamCounts = countsB;
      opponentTeamCounts = countsA;
    } else {
      myTeamCounts = countsA;
      opponentTeamCounts = countsB;
    }
  }

  const teamAChoice = isRpsChoice(rpsState.teamAChoice) ? rpsState.teamAChoice : '';
  const teamBChoice = isRpsChoice(rpsState.teamBChoice) ? rpsState.teamBChoice : '';

  return {
    matchId: match.matchId,
    roundNumber: Math.max(1, rpsState.roundNumber),
    stage: rpsState.stage,
    secondsRemaining,
    canVote: role === 'player' && !!myTeam && rpsState.stage === 'Voting' && secondsRemaining > 0,
    myTeam: myTeam as 'A' | 'B' | '',
    myVote: myVoteChoice,
    myTeamCounts,
    opponentTeamCounts,
    teamAChoice,
    teamBChoice,
    winnerTeam: rpsState.winnerTeam,
    canHostContinue:
      role === 'host' &&
      rpsState.stage === 'Reveal' &&
      (rpsState.winnerTeam === 'A' || rpsState.winnerTeam === 'B'),
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
  identity: string,
  playerStateByPlayerId: Map<string, NormalizedTugPlayerState>
): LobbyViewModel {
  const teamAPlayers = players.filter(player => player.team === 'A');
  const teamBPlayers = players.filter(player => player.team === 'B');

  return {
    lobbyId: lobby.lobbyId,
    joinCode: lobby.joinCode,
    status: lobby.status,
    gameType: lobby.gameType,
    isHost: isSameIdentity(lobby.hostIdentity, identity),
    hostIdentity: lobby.hostIdentity,
    teamA: buildTeamPlayerViewModel(teamAPlayers, identity, playerStateByPlayerId),
    teamB: buildTeamPlayerViewModel(teamBPlayers, identity, playerStateByPlayerId),
    teamACounts: buildTeamCounts(teamAPlayers),
    teamBCounts: buildTeamCounts(teamBPlayers),
  };
}

function buildMatchHudModel(
  match: NormalizedMatch,
  clock: NormalizedMatchClock | null,
  tug: NormalizedTugState | null,
  snapshotGeneratedAt: number,
  teamAPlayers: NormalizedPlayer[],
  teamBPlayers: NormalizedPlayer[],
  matchPlayerStates: NormalizedTugPlayerState[],
  hostState: NormalizedTugHostState | null,
  myState: NormalizedTugPlayerState | null
): MatchHudViewModel {
  const ropePosition = tug?.ropePosition ?? 0;
  const winThreshold = tug?.winThreshold ?? 100;
  const tieZonePercent = Math.max(0, tug?.tieZonePercent ?? 10);
  const tieZoneBounds = normalizeTieZoneBounds(winThreshold, tieZonePercent);
  const rampTier = Math.max(1, Math.min(5, tug?.rampTier ?? 1));
  const effectiveTier = Math.max(
    1,
    Math.min(5, rampTier + Math.max(0, tug?.difficultyBonusTier ?? 0))
  );
  const activePowerId = tug?.activePowerId ?? '';
  const nowMicros = BigInt(Math.trunc(snapshotGeneratedAt)) * 1000n;
  const remainingPowerMicros =
    (tug?.powerExpiresAtMicros ?? 0n) > nowMicros
      ? (tug?.powerExpiresAtMicros ?? 0n) - nowMicros
      : 0n;
  const activePowerSecondsRemaining =
    activePowerId && (tug?.powerExpiresAtMicros ?? 0n) > 0n
      ? Math.max(
          0,
          Math.ceil(Number(remainingPowerMicros) / 1_000_000)
        )
      : null;
  const teamAIds = new Set(teamAPlayers.map(player => player.playerId));
  const teamBIds = new Set(teamBPlayers.map(player => player.playerId));

  let teamAPulls = 0;
  let teamBPulls = 0;
  for (const playerState of matchPlayerStates) {
    if (teamAIds.has(playerState.playerId)) {
      teamAPulls += playerState.correctCount;
      continue;
    }
    if (teamBIds.has(playerState.playerId)) {
      teamBPulls += playerState.correctCount;
    }
  }

  return {
    matchId: match.matchId,
    phase: match.phase,
    secondsRemaining: clock ? clock.secondsRemaining : null,
    winnerTeam: match.winnerTeam,
    ropePosition,
    normalizedRopePosition: normalizeRopePosition(ropePosition, winThreshold),
    winThreshold,
    tieZoneStartPercent: tieZoneBounds.start,
    tieZoneEndPercent: tieZoneBounds.end,
    teamAForce: tug?.teamAForce ?? 0,
    teamBForce: tug?.teamBForce ?? 0,
    teamAPulls,
    teamBPulls,
    hostPowerMeter: hostState?.powerMeter ?? 0,
    wordMode: tug?.wordMode ?? 'Normal',
    rampTier,
    effectiveTier,
    activePowerId,
    activePowerSecondsRemaining,
    hostScore: hostState ? hostState.score : null,
    hostSuccessfulWords: hostState ? hostState.correctCount : null,
    hostCurrentWord: hostState?.currentWord ?? '',
    aliveTeamA: teamAPlayers.filter(player => player.status === 'Active').length,
    aliveTeamB: teamBPlayers.filter(player => player.status === 'Active').length,
    currentWord: tug?.currentWord ?? '',
    wordVersion: tug?.wordVersion ?? 0,
    mode: tug?.mode ?? 'Normal',
    suddenDeathDeadlineMicros:
      myState && myState.deadlineAtMicros > 0n ? myState.deadlineAtMicros : null,
  };
}

function buildPreMatchHudModel(
  lobbyId: string,
  preMatchSecondsRemaining: number
): MatchHudViewModel {
  return {
    matchId: `${lobbyId}:pre`,
    phase: 'PreGame',
    secondsRemaining: preMatchSecondsRemaining,
    winnerTeam: '',
    ropePosition: 0,
    normalizedRopePosition: 50,
    winThreshold: 100,
    tieZoneStartPercent: 45,
    tieZoneEndPercent: 55,
    teamAForce: 0,
    teamBForce: 0,
    teamAPulls: 0,
    teamBPulls: 0,
    hostPowerMeter: 0,
    wordMode: 'Normal',
    rampTier: 1,
    effectiveTier: 1,
    activePowerId: '',
    activePowerSecondsRemaining: null,
    hostScore: null,
    hostSuccessfulWords: null,
    hostCurrentWord: '',
    aliveTeamA: 0,
    aliveTeamB: 0,
    currentWord: '',
    wordVersion: 0,
    mode: 'Normal',
    suddenDeathDeadlineMicros: null,
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
        preMatchHud: null,
        preMatchSecondsRemaining: DEFAULT_ROUND_SECONDS,
        rpsTieBreak: null,
        hostPanel: null,
        playerInput: null,
        events: [],
      };
    }

  const preMatchSecondsRemaining = getLobbySettingInt(
    snapshot.lobbySettings,
    lobby.lobbyId,
    'round_seconds',
    DEFAULT_ROUND_SECONDS
  );

  const lobbyPlayers = snapshot.players.filter(player => player.lobbyId === lobby.lobbyId);
  const myPlayer =
    lobbyPlayers.find(player => isSameIdentity(player.identity, identity)) ?? null;

  const match = lobby.activeMatchId
    ? snapshot.matches.find(item => item.matchId === lobby.activeMatchId) ?? null
    : null;

  const clock = match
    ? snapshot.clocks.find(item => item.matchId === match.matchId) ?? null
    : null;

  const tug = match
    ? snapshot.tugStates.find(item => item.matchId === match.matchId) ?? null
    : null;
  const rpsState = match
    ? snapshot.tugRpsStates.find(item => item.matchId === match.matchId) ?? null
    : null;
  const rpsVotes = match
    ? snapshot.tugRpsVotes.filter(item => item.matchId === match.matchId)
    : [];
  const matchPlayerStates = match
    ? snapshot.tugPlayerStates.filter(item => item.matchId === match.matchId)
    : [];
  const playerStateByPlayerId = new Map(
    matchPlayerStates.map(playerState => [playerState.playerId, playerState] as const)
  );
  const hostState = match
    ? snapshot.tugHostStates.find(item => item.matchId === match.matchId) ?? null
    : null;

  const myTugState =
    match && myPlayer
      ? matchPlayerStates.find(
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
    lobby: buildLobbyModel(lobby, lobbyPlayers, identity, playerStateByPlayerId),
    matchHud: match
        ? buildMatchHudModel(
          match,
          clock,
          tug,
          snapshot.generatedAt,
          teamAPlayers,
          teamBPlayers,
          matchPlayerStates,
          hostState,
          myTugState
        )
      : null,
    preMatchHud: match ? null : buildPreMatchHudModel(lobby.lobbyId, preMatchSecondsRemaining),
    preMatchSecondsRemaining,
    rpsTieBreak: buildRpsTieBreakModel(
      role,
      match,
      rpsState,
      rpsVotes,
      myPlayer,
      snapshot.generatedAt
    ),
    hostPanel: buildHostPanelModel(
      isSameIdentity(lobby.hostIdentity, identity),
      lobby,
      match,
      hostState
    ),
    playerInput: buildPlayerInputModel(role, myPlayer, match, myTugState, hostState),
    events: buildEventFeed(snapshot, lobby.lobbyId),
  };
}
