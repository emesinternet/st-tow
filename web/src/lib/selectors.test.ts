import test from 'node:test';
import assert from 'node:assert/strict';
import { selectUiViewModel } from './selectors';
import type { SessionSnapshot } from '../data/selectors';

function makeBaseSnapshot(): SessionSnapshot {
  return {
    lobbies: [
      {
        lobbyId: 'lobby-1',
        joinCode: 'ABCD',
        hostIdentity: 'c200host',
        status: 'Running',
        gameType: 'tug_of_war',
        activeMatchId: 'match-1',
        createdAtMicros: 10n,
      },
    ],
    lobbySettings: [],
    players: [
      {
        playerId: 'player-a',
        lobbyId: 'lobby-1',
        identity: 'c200abcd',
        lobbyIdentityKey: 'lobby-1:c200abcd',
        displayName: 'Player One',
        team: 'A',
        status: 'Active',
        joinedAtMicros: 11n,
        leftAtMicros: 0n,
        eliminatedReason: '',
      },
      {
        playerId: 'player-b',
        lobbyId: 'lobby-1',
        identity: 'c200efgh',
        lobbyIdentityKey: 'lobby-1:c200efgh',
        displayName: 'Player Two',
        team: 'B',
        status: 'Active',
        joinedAtMicros: 12n,
        leftAtMicros: 0n,
        eliminatedReason: '',
      },
    ],
    matches: [
      {
        matchId: 'match-1',
        lobbyId: 'lobby-1',
        gameType: 'tug_of_war',
        phase: 'InGame',
        startedAtMicros: 20n,
        endsAtMicros: 0n,
        winnerTeam: '',
        winnerPlayerId: '',
        seed: 1,
      },
    ],
    clocks: [
      {
        matchId: 'match-1',
        phaseEndsAtMicros: 30n,
        secondsRemaining: 30,
        tickRateMs: 200,
      },
    ],
    tugStates: [
      {
        matchId: 'match-1',
        ropePosition: 0,
        winThreshold: 10,
        tieZonePercent: 10,
        teamAForce: 7,
        teamBForce: 4,
        currentWord: '',
        wordVersion: 1,
        mode: 'Normal',
        wordMode: 'Normal',
        rampTier: 2,
        difficultyBonusTier: 1,
        activePowerId: 'tech_mode_burst',
        powerExpiresAtMicros: 9_999_999_000n,
        wordRotateMs: 9999,
        eliminationWordTimeMs: 2000,
        nextWordAtMicros: 0n,
        lastTickAtMicros: 0n,
      },
    ],
    tugCameraStates: [
      {
        matchId: 'match-1',
        hostIdentity: 'c200host',
        enabled: true,
        streamEpoch: 2,
        updatedAtMicros: 0n,
      },
    ],
    tugWebrtcSignals: [],
    tugRpsStates: [],
    tugRpsVotes: [],
    tugPlayerStates: [
      {
        tugPlayerStateId: 'tps-a',
        matchId: 'match-1',
        playerId: 'player-a',
        currentWord: 'anchor',
        lastWordType: 'object',
        correctCount: 3,
        correctCharCount: 9,
        missCharCount: 3,
        submitCount: 4,
        lastSubmitAtMicros: 0n,
        deadlineAtMicros: 0n,
      },
      {
        tugPlayerStateId: 'tps-b',
        matchId: 'match-1',
        playerId: 'player-b',
        currentWord: 'bridge',
        lastWordType: 'object',
        correctCount: 5,
        correctCharCount: 10,
        missCharCount: 2,
        submitCount: 6,
        lastSubmitAtMicros: 0n,
        deadlineAtMicros: 0n,
      },
    ],
    tugHostStates: [
      {
        matchId: 'match-1',
        hostIdentity: 'c200host',
        score: 9,
        correctCount: 9,
        correctCharCount: 54,
        missCharCount: 6,
        powerMeter: 42,
        currentWord: 'captain',
        lastWordType: 'command',
        wordVersion: 3,
        lastSubmitAtMicros: 0n,
      },
    ],
    events: [],
    generatedAt: Date.now(),
  };
}

test('selectUiViewModel resolves player by identity case and exposes current word', () => {
  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot: makeBaseSnapshot(),
    identity: 'C200ABCD',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.role, 'player');
  assert.equal(vm.playerInput?.currentWord, 'anchor');
  assert.equal(vm.playerInput?.canSubmit, true);
});

test('selector keeps force fields physical and pull fields cumulative', () => {
  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot: makeBaseSnapshot(),
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.matchHud?.teamAForce, 7);
  assert.equal(vm.matchHud?.teamBForce, 4);
  assert.equal(vm.matchHud?.teamAPulls, 3);
  assert.equal(vm.matchHud?.teamBPulls, 5);
  assert.equal(vm.lobby?.teamA[0]?.accuracy, 75);
  assert.equal(vm.lobby?.teamB[0]?.accuracy, 83);
  assert.equal(vm.lobby?.teamA[0]?.lastCorrectAtMicros, 0n);
  assert.equal(vm.lobby?.teamB[0]?.lastCorrectAtMicros, 0n);
});

test('selector derives lastCorrectAtMicros from submit_ok events', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.events = [
    {
      eventId: 'event-1',
      lobbyId: 'lobby-1',
      matchId: 'match-1',
      type: 'submit_ok',
      payloadJson: '{"player_id":"player-a"}',
      atMicros: 101n,
    },
    {
      eventId: 'event-2',
      lobbyId: 'lobby-1',
      matchId: 'match-1',
      type: 'submit_ok',
      payloadJson: '{"playerId":"player-b"}',
      atMicros: 250n,
    },
    {
      eventId: 'event-3',
      lobbyId: 'lobby-1',
      matchId: 'match-1',
      type: 'submit_ok',
      payloadJson: '{"player_id":"player-a"}',
      atMicros: 320n,
    },
    {
      eventId: 'event-4',
      lobbyId: 'lobby-1',
      matchId: 'match-1',
      type: 'submit_bad',
      payloadJson: '{"player_id":"player-a"}',
      atMicros: 999n,
    },
    {
      eventId: 'event-5',
      lobbyId: 'lobby-1',
      matchId: 'match-other',
      type: 'submit_ok',
      payloadJson: '{"player_id":"player-a"}',
      atMicros: 9999n,
    },
  ];

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.lobby?.teamA[0]?.lastCorrectAtMicros, 320n);
  assert.equal(vm.lobby?.teamB[0]?.lastCorrectAtMicros, 250n);
});

test('selector keeps player accuracy in post-game states', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.lobbies[0] = {
    ...snapshot.lobbies[0],
    status: 'Finished',
  };
  snapshot.matches[0] = {
    ...snapshot.matches[0],
    phase: 'PostGame',
    winnerTeam: '',
  };

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.phase, 'post');
  assert.equal(vm.lobby?.teamA[0]?.accuracy, 75);
  assert.equal(vm.lobby?.teamB[0]?.accuracy, 83);
});

test('selector never shows 100 accuracy when character misses exist', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.tugPlayerStates[0] = {
    ...snapshot.tugPlayerStates[0],
    correctCount: 299,
    submitCount: 300,
    correctCharCount: 299,
    missCharCount: 1,
  };

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.lobby?.teamA[0]?.accuracy, 99);
});

test('selector exposes host score from tug_host_state when present', () => {
  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot: makeBaseSnapshot(),
    identity: 'c200host',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.role, 'host');
  assert.equal(vm.matchHud?.hostScore, 9);
  assert.equal(vm.matchHud?.hostSuccessfulWords, 9);
  assert.equal(vm.matchHud?.hostPowerMeter, 42);
  assert.equal(vm.matchHud?.wordMode, 'Normal');
  assert.equal(vm.matchHud?.effectiveTier, 3);
  assert.equal(vm.matchHud?.activePowerId, 'tech_mode_burst');
  assert.equal(vm.matchHud?.hostCameraEnabled, true);
  assert.equal(vm.matchHud?.hostCameraStreamEpoch, 2);
  assert.equal(vm.matchHud?.hostCameraHostIdentity, 'c200host');
  assert.equal(vm.playerInput?.currentWord, 'captain');
  assert.equal(
    vm.hostPanel?.powers.some((power) => power.enabled),
    true
  );
  assert.equal(vm.hostPanel?.cameraEnabled, true);
  assert.equal(vm.hostPanel?.canToggleCamera, true);
});

test('selector exposes host display name when host player row exists', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.players.push({
    playerId: 'player-host',
    lobbyId: 'lobby-1',
    identity: 'c200host',
    lobbyIdentityKey: 'lobby-1:c200host',
    displayName: 'Captain Host',
    team: '',
    status: 'Active',
    joinedAtMicros: 9n,
    leftAtMicros: 0n,
    eliminatedReason: '',
  });

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.lobby?.hostDisplayName, 'Captain Host');
});

test('selector clamps ramp and effective tier to 8', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.tugStates[0] = {
    ...snapshot.tugStates[0],
    rampTier: 12,
    difficultyBonusTier: 5,
  };

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200host',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.matchHud?.rampTier, 8);
  assert.equal(vm.matchHud?.effectiveTier, 8);
});

test('selector derives pre-match seconds from round_seconds setting with fallback', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.lobbies[0] = {
    ...snapshot.lobbies[0],
    status: 'Waiting',
    activeMatchId: '',
  };
  snapshot.matches = [];
  snapshot.clocks = [];
  snapshot.tugStates = [];
  snapshot.tugCameraStates = [];
  snapshot.tugWebrtcSignals = [];
  snapshot.tugRpsStates = [];
  snapshot.tugRpsVotes = [];
  snapshot.tugPlayerStates = [];
  snapshot.tugHostStates = [];

  snapshot.lobbySettings = [
    {
      settingId: 'lobby-1:round_seconds',
      lobbyId: 'lobby-1',
      key: 'round_seconds',
      valueJson: '120',
    },
    {
      settingId: 'lobby-1:tie_zone_percent',
      lobbyId: 'lobby-1',
      key: 'tie_zone_percent',
      valueJson: '20',
    },
  ];

  const withSetting = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });
  assert.equal(withSetting.preMatchSecondsRemaining, 120);
  assert.equal(withSetting.preMatchHud?.secondsRemaining, 120);
  assert.equal(withSetting.preMatchHud?.tieZoneStartPercent, 40);
  assert.equal(withSetting.preMatchHud?.tieZoneEndPercent, 60);

  snapshot.lobbySettings = [];
  const withFallback = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });
  assert.equal(withFallback.preMatchSecondsRemaining, 90);
  assert.equal(withFallback.preMatchHud?.secondsRemaining, 90);
  assert.equal(withFallback.preMatchHud?.tieZoneStartPercent, 45);
  assert.equal(withFallback.preMatchHud?.tieZoneEndPercent, 55);
});

test('selector hides counts for host during voting and shows own team counts for player', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.matches[0] = {
    ...snapshot.matches[0],
    phase: 'TieBreakRps',
  };
  snapshot.tugRpsStates = [
    {
      matchId: 'match-1',
      roundNumber: 1,
      stage: 'Voting',
      votingEndsAtMicros: BigInt(snapshot.generatedAt) * 1000n + 5_000_000n,
      teamAChoice: '',
      teamBChoice: '',
      winnerTeam: '',
      createdAtMicros: 0n,
    },
  ];
  snapshot.tugRpsVotes = [
    {
      tugRpsVoteId: 'match-1:player-a',
      matchId: 'match-1',
      playerId: 'player-a',
      team: 'A',
      choice: 'rock',
      submittedAtMicros: 0n,
    },
    {
      tugRpsVoteId: 'match-1:player-b',
      matchId: 'match-1',
      playerId: 'player-b',
      team: 'B',
      choice: 'paper',
      submittedAtMicros: 0n,
    },
  ];

  const hostVm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200host',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });
  assert.equal(hostVm.rpsTieBreak?.stage, 'Voting');
  assert.equal(hostVm.rpsTieBreak?.myTeamCounts, null);
  assert.equal(hostVm.rpsTieBreak?.opponentTeamCounts, null);

  const playerVm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });
  assert.equal(playerVm.rpsTieBreak?.stage, 'Voting');
  assert.equal(playerVm.rpsTieBreak?.myTeam, 'A');
  assert.equal(playerVm.rpsTieBreak?.myTeamCounts?.rock, 1);
  assert.equal(playerVm.rpsTieBreak?.opponentTeamCounts, null);
});

test('selector exposes both team choices in reveal stage', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.matches[0] = {
    ...snapshot.matches[0],
    phase: 'TieBreakRps',
  };
  snapshot.tugRpsStates = [
    {
      matchId: 'match-1',
      roundNumber: 2,
      stage: 'Reveal',
      votingEndsAtMicros: 0n,
      teamAChoice: 'rock',
      teamBChoice: 'scissors',
      winnerTeam: 'A',
      createdAtMicros: 0n,
    },
  ];
  snapshot.tugRpsVotes = [];

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200host',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.rpsTieBreak?.stage, 'Reveal');
  assert.equal(vm.rpsTieBreak?.teamAChoice, 'rock');
  assert.equal(vm.rpsTieBreak?.teamBChoice, 'scissors');
  assert.equal(vm.rpsTieBreak?.winnerTeam, 'A');
  assert.equal(vm.rpsTieBreak?.canHostContinue, true);
});

test('selector derives reveal winner from choices when winner team is temporarily empty', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.matches[0] = {
    ...snapshot.matches[0],
    phase: 'TieBreakRps',
  };
  snapshot.tugRpsStates = [
    {
      matchId: 'match-1',
      roundNumber: 2,
      stage: 'Reveal',
      votingEndsAtMicros: 0n,
      teamAChoice: 'rock',
      teamBChoice: 'paper',
      winnerTeam: '',
      createdAtMicros: 0n,
    },
  ];
  snapshot.tugRpsVotes = [];

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200host',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.rpsTieBreak?.stage, 'Reveal');
  assert.equal(vm.rpsTieBreak?.teamAChoice, 'rock');
  assert.equal(vm.rpsTieBreak?.teamBChoice, 'paper');
  assert.equal(vm.rpsTieBreak?.winnerTeam, 'B');
  assert.equal(vm.rpsTieBreak?.canHostContinue, false);
});

test('selector normalizes reveal choices before winner derivation', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.matches[0] = {
    ...snapshot.matches[0],
    phase: 'TieBreakRps',
  };
  snapshot.tugRpsStates = [
    {
      matchId: 'match-1',
      roundNumber: 3,
      stage: 'Reveal',
      votingEndsAtMicros: 0n,
      teamAChoice: ' Rock ',
      teamBChoice: 'PAPER',
      winnerTeam: '',
      createdAtMicros: 0n,
    },
  ];
  snapshot.tugRpsVotes = [];

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200host',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.rpsTieBreak?.teamAChoice, 'rock');
  assert.equal(vm.rpsTieBreak?.teamBChoice, 'paper');
  assert.equal(vm.rpsTieBreak?.winnerTeam, 'B');
});

test('selector does not resolve lobby from Left membership', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.players[0] = {
    ...snapshot.players[0],
    status: 'Left',
    leftAtMicros: 99n,
  };

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: 'lobby-1',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.equal(vm.phase, 'landing');
  assert.equal(vm.lobby, null);
  assert.equal(vm.role, 'observer');
});

test('selector skips event feed work by default', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.events = [
    {
      eventId: 'event-1',
      lobbyId: 'lobby-1',
      matchId: 'match-1',
      type: 'submit_ok',
      payloadJson: '{}',
      atMicros: 100n,
    },
  ];

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
  });

  assert.deepEqual(vm.events, []);
});

test('selector returns event feed when explicitly enabled', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.events = [
    {
      eventId: 'event-1',
      lobbyId: 'lobby-1',
      matchId: 'match-1',
      type: 'submit_ok',
      payloadJson: '{}',
      atMicros: 100n,
    },
    {
      eventId: 'event-2',
      lobbyId: 'lobby-1',
      matchId: 'match-1',
      type: 'submit_bad',
      payloadJson: '{}',
      atMicros: 200n,
    },
  ];

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
    ignoredLobbyId: '',
    includeEventFeed: true,
    eventFeedLimit: 1,
  });

  assert.equal(vm.events.length, 1);
  assert.equal(vm.events[0]?.eventId, 'event-2');
});
