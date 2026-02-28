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
        playerId: 'player-1',
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
        teamAForce: 0,
        teamBForce: 0,
        currentWord: '',
        wordVersion: 1,
        mode: 'Normal',
        wordRotateMs: 9999,
        eliminationWordTimeMs: 2000,
        nextWordAtMicros: 0n,
        lastTickAtMicros: 0n,
      },
    ],
    tugPlayerStates: [
      {
        tugPlayerStateId: 'tps-1',
        matchId: 'match-1',
        playerId: 'player-1',
        currentWord: 'anchor',
        correctCount: 0,
        lastSubmitAtMicros: 0n,
        deadlineAtMicros: 0n,
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

test('selectUiViewModel disables submit when player has no assigned word', () => {
  const snapshot = makeBaseSnapshot();
  snapshot.tugPlayerStates = [];

  const vm = selectUiViewModel({
    connectionState: 'connected',
    snapshot,
    identity: 'c200abcd',
    selectedLobbyId: '',
    pendingJoinCode: '',
  });

  assert.equal(vm.playerInput?.canSubmit, false);
  assert.equal(vm.playerInput?.disabledReason, 'Waiting for your next word.');
});
