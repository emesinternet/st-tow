import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_SNAPSHOT, type SessionSnapshot } from '@/data/selectors';
import { buildScopedQueries, deriveScope } from '@/data/subscriptionScope';

function makeSnapshot(): SessionSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
    lobbies: [
      {
        lobbyId: 'lobby-1',
        joinCode: 'ABCD12',
        hostIdentity: 'host-identity',
        status: 'Running',
        gameType: 'tug_of_war',
        activeMatchId: 'match-1',
        createdAtMicros: 20n,
      },
    ],
    players: [
      {
        playerId: 'player-1',
        lobbyId: 'lobby-1',
        identity: 'player-identity',
        lobbyIdentityKey: 'lobby-1:player-identity',
        displayName: 'Player',
        team: 'A',
        status: 'Active',
        joinedAtMicros: 25n,
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
        startedAtMicros: 30n,
        endsAtMicros: 0n,
        winnerTeam: '',
        winnerPlayerId: '',
        seed: 1,
      },
    ],
  };
}

test('deriveScope resolves lobby and match for host identity', () => {
  const snapshot = makeSnapshot();
  const scope = deriveScope(snapshot, 'HOST-IDENTITY');

  assert.equal(scope.lobbyId, 'lobby-1');
  assert.equal(scope.matchId, 'match-1');
});

test('deriveScope resolves lobby and match for active player identity', () => {
  const snapshot = makeSnapshot();
  const scope = deriveScope(snapshot, 'PLAYER-IDENTITY');

  assert.equal(scope.lobbyId, 'lobby-1');
  assert.equal(scope.matchId, 'match-1');
});

test('buildScopedQueries returns only lobby scoped queries when no match id', () => {
  const queries = buildScopedQueries({ lobbyId: 'lobby-1', matchId: '' });

  assert.deepEqual(queries, [
    "SELECT * FROM lobby_settings WHERE lobby_id = 'lobby-1'",
    "SELECT * FROM game_event WHERE lobby_id = 'lobby-1'",
  ]);
});

test('buildScopedQueries includes all match tables when match id exists', () => {
  const queries = buildScopedQueries({ lobbyId: 'lobby-1', matchId: 'match-1' });

  assert.equal(
    queries.includes("SELECT * FROM tug_webrtc_signal WHERE match_id = 'match-1'"),
    true
  );
  assert.equal(queries.includes("SELECT * FROM tug_host_state WHERE match_id = 'match-1'"), true);
  assert.equal(queries.length, 10);
});

test('buildScopedQueries escapes single quotes in identifiers', () => {
  const queries = buildScopedQueries({ lobbyId: "lob'by", matchId: "mat'ch" });

  assert.equal(queries.includes("SELECT * FROM lobby_settings WHERE lobby_id = 'lob''by'"), true);
  assert.equal(queries.includes("SELECT * FROM tug_state WHERE match_id = 'mat''ch'"), true);
});
