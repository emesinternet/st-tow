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
    tugPlayerStates: [
      {
        tugPlayerStateId: 'tps-a',
        matchId: 'match-1',
        playerId: 'player-a',
        currentWord: 'anchor',
        lastWordType: 'object',
        correctCount: 3,
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
  });

  assert.equal(vm.matchHud?.teamAForce, 7);
  assert.equal(vm.matchHud?.teamBForce, 4);
  assert.equal(vm.matchHud?.teamAPulls, 3);
  assert.equal(vm.matchHud?.teamBPulls, 5);
  assert.equal(vm.lobby?.teamA[0]?.accuracy, 75);
  assert.equal(vm.lobby?.teamB[0]?.accuracy, 83);
});

test('selector exposes host score from tug_host_state when present', () => {
  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot: makeBaseSnapshot(),
    identity: 'c200host',
    selectedLobbyId: '',
    pendingJoinCode: '',
  });

  assert.equal(vm.role, 'host');
  assert.equal(vm.matchHud?.hostScore, 9);
  assert.equal(vm.matchHud?.hostSuccessfulWords, 9);
  assert.equal(vm.matchHud?.hostPowerMeter, 42);
  assert.equal(vm.matchHud?.wordMode, 'Normal');
  assert.equal(vm.matchHud?.effectiveTier, 3);
  assert.equal(vm.matchHud?.activePowerId, 'tech_mode_burst');
  assert.equal(vm.playerInput?.currentWord, 'captain');
  assert.equal(vm.hostPanel?.powers.some(power => power.enabled), true);
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
  snapshot.tugPlayerStates = [];
  snapshot.tugHostStates = [];

  snapshot.lobbySettings = [
    {
      settingId: 'lobby-1:round_seconds',
      lobbyId: 'lobby-1',
      key: 'round_seconds',
      valueJson: '120',
    },
  ];

  const withSetting = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
  });
  assert.equal(withSetting.preMatchSecondsRemaining, 120);
  assert.equal(withSetting.preMatchHud?.secondsRemaining, 120);

  snapshot.lobbySettings = [];
  const withFallback = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
  });
  assert.equal(withFallback.preMatchSecondsRemaining, 90);
  assert.equal(withFallback.preMatchHud?.secondsRemaining, 90);
});
