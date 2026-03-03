import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionSnapshot } from '@/data/selectors';
import { buildSnapshotIndex } from '@/lib/snapshotIndex';

function makeSnapshot(): SessionSnapshot {
  return {
    lobbies: [
      {
        lobbyId: 'lobby-1',
        joinCode: 'ABCD',
        hostIdentity: 'host-a',
        status: 'Waiting',
        gameType: 'tug_of_war',
        activeMatchId: 'match-1',
        createdAtMicros: 100n,
      },
      {
        lobbyId: 'lobby-2',
        joinCode: 'EFGH',
        hostIdentity: 'host-a',
        status: 'Running',
        gameType: 'tug_of_war',
        activeMatchId: 'match-2',
        createdAtMicros: 200n,
      },
    ],
    lobbySettings: [
      { settingId: 's1', lobbyId: 'lobby-1', key: 'round_seconds', valueJson: '180' },
      { settingId: 's2', lobbyId: 'lobby-2', key: 'round_seconds', valueJson: '240' },
    ],
    players: [
      {
        playerId: 'p1',
        lobbyId: 'lobby-1',
        identity: 'User-A',
        lobbyIdentityKey: 'lobby-1:user-a',
        displayName: 'A',
        team: 'A',
        status: 'Active',
        joinedAtMicros: 10n,
        leftAtMicros: 0n,
        eliminatedReason: '',
      },
      {
        playerId: 'p2',
        lobbyId: 'lobby-2',
        identity: 'user-a',
        lobbyIdentityKey: 'lobby-2:user-a',
        displayName: 'B',
        team: 'B',
        status: 'Active',
        joinedAtMicros: 20n,
        leftAtMicros: 0n,
        eliminatedReason: '',
      },
      {
        playerId: 'p3',
        lobbyId: 'lobby-2',
        identity: 'user-a',
        lobbyIdentityKey: 'lobby-2:user-a',
        displayName: 'C',
        team: 'A',
        status: 'Left',
        joinedAtMicros: 30n,
        leftAtMicros: 40n,
        eliminatedReason: '',
      },
    ],
    matches: [
      {
        matchId: 'match-1',
        lobbyId: 'lobby-1',
        gameType: 'tug_of_war',
        phase: 'InGame',
        startedAtMicros: 0n,
        endsAtMicros: 0n,
        winnerTeam: '',
        winnerPlayerId: '',
        seed: 1,
      },
      {
        matchId: 'match-2',
        lobbyId: 'lobby-2',
        gameType: 'tug_of_war',
        phase: 'InGame',
        startedAtMicros: 0n,
        endsAtMicros: 0n,
        winnerTeam: '',
        winnerPlayerId: '',
        seed: 2,
      },
    ],
    clocks: [],
    tugStates: [],
    tugCameraStates: [],
    tugWebrtcSignals: [],
    tugRpsStates: [],
    tugRpsVotes: [],
    tugPlayerStates: [
      {
        tugPlayerStateId: 'tps-1',
        matchId: 'match-1',
        playerId: 'p1',
        currentWord: 'alpha',
        lastWordType: 'object',
        correctCount: 1,
        correctCharCount: 5,
        missCharCount: 0,
        submitCount: 1,
        lastSubmitAtMicros: 0n,
        deadlineAtMicros: 0n,
      },
      {
        tugPlayerStateId: 'tps-2',
        matchId: 'match-2',
        playerId: 'p2',
        currentWord: 'beta',
        lastWordType: 'object',
        correctCount: 2,
        correctCharCount: 8,
        missCharCount: 1,
        submitCount: 3,
        lastSubmitAtMicros: 0n,
        deadlineAtMicros: 0n,
      },
    ],
    tugHostStates: [],
    events: [],
    generatedAt: 0,
  };
}

test('buildSnapshotIndex caches by snapshot identity', () => {
  const snapshot = makeSnapshot();
  const first = buildSnapshotIndex(snapshot);
  const second = buildSnapshotIndex(snapshot);
  assert.equal(first, second);
});

test('buildSnapshotIndex groups host lobbies and player memberships', () => {
  const index = buildSnapshotIndex(makeSnapshot());
  const hostLobbies = index.hostLobbiesByIdentity.get('host-a') ?? [];
  assert.equal(hostLobbies.length, 2);
  assert.equal(hostLobbies[0]?.lobbyId, 'lobby-2');

  const memberships = index.nonLeftMembershipsByIdentity.get('user-a') ?? [];
  assert.equal(memberships.length, 2);
  assert.equal(memberships[0]?.lobbyId, 'lobby-2');
  assert.equal(memberships[1]?.lobbyId, 'lobby-1');
});

test('buildSnapshotIndex excludes left players from myPlayer identity map', () => {
  const index = buildSnapshotIndex(makeSnapshot());
  const lobby2ByIdentity = index.myPlayerByLobbyIdAndIdentity.get('lobby-2');
  assert.equal(lobby2ByIdentity?.get('user-a')?.playerId, 'p2');
});

test('buildSnapshotIndex groups tug player states by match', () => {
  const index = buildSnapshotIndex(makeSnapshot());
  assert.equal(index.tugPlayerStatesByMatchId.get('match-1')?.length, 1);
  assert.equal(index.tugPlayerStatesByMatchId.get('match-2')?.[0]?.playerId, 'p2');
});
