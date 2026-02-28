import type { DbConnection } from '@/module_bindings';

type ReducerFn = (params: Record<string, unknown>) => Promise<void>;

type ReducerBag = Record<string, ReducerFn | undefined>;

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_match, group: string) => group.toUpperCase());
}

async function callReducer(
  connection: DbConnection,
  reducerName: string,
  params: Record<string, unknown>
): Promise<void> {
  const reducers = connection.reducers as unknown as ReducerBag;
  const candidates = [snakeToCamel(reducerName), reducerName];

  for (const name of candidates) {
    const reducer = reducers[name];
    if (typeof reducer === 'function') {
      await reducer(params);
      return;
    }
  }

  throw new Error(`Reducer not found: ${reducerName}`);
}

function assertConnection(connection: DbConnection | null): DbConnection {
  if (!connection) {
    throw new Error('Not connected to SpacetimeDB');
  }
  return connection;
}

export interface GameActions {
  createLobby: (gameType: string, roundSeconds: number) => Promise<void>;
  joinLobby: (joinCode: string, displayName: string) => Promise<void>;
  setLobbySetting: (lobbyId: string, key: string, valueJson: string) => Promise<void>;
  startMatch: (lobbyId: string) => Promise<void>;
  resetLobby: (lobbyId: string) => Promise<void>;
  endMatch: (lobbyId: string) => Promise<void>;
  submitWord: (matchId: string, wordVersion: number, typed: string) => Promise<void>;
  recordMistake: (matchId: string) => Promise<void>;
}

export function buildActions(connection: DbConnection | null): GameActions {
  return {
    createLobby: async (gameType: string, roundSeconds: number) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'create_lobby', { gameType, roundSeconds });
    },
    joinLobby: async (joinCode: string, displayName: string) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'join_lobby', {
        joinCode,
        displayName,
      });
    },
    setLobbySetting: async (lobbyId: string, key: string, valueJson: string) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'set_lobby_setting', {
        lobbyId,
        key,
        valueJson,
      });
    },
    startMatch: async (lobbyId: string) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'start_match', { lobbyId });
    },
    resetLobby: async (lobbyId: string) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'reset_lobby', { lobbyId });
    },
    endMatch: async (lobbyId: string) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'end_match', { lobbyId });
    },
    submitWord: async (matchId: string, wordVersion: number, typed: string) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'tug_submit', {
        matchId,
        wordVersion,
        typed,
      });
    },
    recordMistake: async (matchId: string) => {
      const conn = assertConnection(connection);
      await callReducer(conn, 'tug_record_miss', {
        matchId,
      });
    },
  };
}
