import { useCallback, useEffect, useMemo, useState } from 'react';
import { DbConnection, tables } from '@/module_bindings';
import { buildActions, type GameActions } from '@/data/actions';
import { EMPTY_SNAPSHOT, extractSnapshot, type SessionSnapshot } from '@/data/selectors';
import { buildScopedQueries, deriveScope } from '@/data/subscriptionScope';
import type { ConnectionState } from '@/types/ui';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://127.0.0.1:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'st-tow';
const TOKEN_KEY = 'auth_token';
const ENABLE_SCOPED_SUBSCRIPTIONS = import.meta.env.VITE_SCOPED_SUBSCRIPTIONS === '1';

type TableWithListeners = {
  onInsert?: (callback: () => void) => void;
  onDelete?: (callback: () => void) => void;
  onUpdate?: (callback: () => void) => void;
};

type SubscriptionHandle = {
  unsubscribe: () => void;
};

export interface SpacetimeSession {
  connection: DbConnection | null;
  state: ConnectionState;
  identity: string;
  errorMessage: string | null;
  snapshot: SessionSnapshot;
  actions: GameActions;
  refresh: () => void;
}

export function useSpacetimeSession(): SpacetimeSession {
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [state, setState] = useState<ConnectionState>('connecting');
  const [identity, setIdentity] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(EMPTY_SNAPSHOT);

  const refreshFromConnection = useCallback((conn: DbConnection) => {
    setSnapshot(extractSnapshot(conn));
  }, []);

  useEffect(() => {
    let isMounted = true;
    let liveConnection: DbConnection | null = null;
    let sessionIdentity = '';
    let baseSubscription: SubscriptionHandle | null = null;
    let scopedSubscription: SubscriptionHandle | null = null;
    let scopedKey = '';

    const pullSnapshot = () => {
      if (!isMounted || !liveConnection) {
        return;
      }
      refreshFromConnection(liveConnection);
    };

    const unsubscribeScoped = () => {
      if (!scopedSubscription) {
        return;
      }
      scopedSubscription.unsubscribe();
      scopedSubscription = null;
      scopedKey = '';
    };

    const refreshScopedSubscription = () => {
      if (!isMounted || !liveConnection || !ENABLE_SCOPED_SUBSCRIPTIONS) {
        return;
      }

      const nextSnapshot = extractSnapshot(liveConnection);
      const nextScope = deriveScope(nextSnapshot, sessionIdentity);
      const nextKey = `${nextScope.lobbyId}:${nextScope.matchId}`;
      if (nextKey === scopedKey) {
        return;
      }

      unsubscribeScoped();

      const queries = buildScopedQueries(nextScope);
      if (!queries.length) {
        return;
      }

      scopedSubscription = liveConnection
        .subscriptionBuilder()
        .onApplied(() => pullSnapshot())
        .subscribe(queries);
      scopedKey = nextKey;
    };

    const conn = DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(DB_NAME)
      .withToken(localStorage.getItem(TOKEN_KEY) || undefined)
      .onConnect((ctx, connectedIdentity, token) => {
        if (!isMounted) {
          ctx.disconnect();
          return;
        }

        liveConnection = ctx;
        setConnection(ctx);
        setState('connected');
        setErrorMessage(null);

        if (token) {
          localStorage.setItem(TOKEN_KEY, token);
        }

        const identityHex =
          connectedIdentity && typeof connectedIdentity.toHexString === 'function'
            ? connectedIdentity.toHexString()
            : '';
        sessionIdentity = identityHex;
        setIdentity(identityHex);

        if (ENABLE_SCOPED_SUBSCRIPTIONS) {
          baseSubscription = ctx
            .subscriptionBuilder()
            .onApplied(() => {
              pullSnapshot();
              refreshScopedSubscription();
            })
            .subscribe(['SELECT * FROM lobby', 'SELECT * FROM player', 'SELECT * FROM match']);
        } else {
          baseSubscription = ctx
            .subscriptionBuilder()
            .onApplied(() => pullSnapshot())
            .subscribe([
              tables.lobby,
              tables.lobby_settings,
              tables.player,
              tables.match,
              tables.match_clock,
              tables.tug_state,
              tables.tug_camera_state,
              tables.tug_webrtc_signal,
              tables.tug_rps_state,
              tables.tug_rps_vote,
              tables.tug_player_state,
              tables.tug_host_state,
              tables.game_event,
            ]);
        }

        for (const table of Object.values(ctx.db as Record<string, unknown>)) {
          const listeners = table as TableWithListeners;
          listeners.onInsert?.(() => pullSnapshot());
          listeners.onUpdate?.(() => pullSnapshot());
          listeners.onDelete?.(() => pullSnapshot());
        }

        pullSnapshot();
        refreshScopedSubscription();
      })
      .onDisconnect(() => {
        if (!isMounted) {
          return;
        }
        unsubscribeScoped();
        if (baseSubscription) {
          baseSubscription.unsubscribe();
          baseSubscription = null;
        }
        setState('disconnected');
        setConnection(null);
      })
      .onConnectError((_ctx, error) => {
        if (!isMounted) {
          return;
        }
        setState('error');
        setErrorMessage(error.message);
      })
      .build();

    return () => {
      isMounted = false;
      unsubscribeScoped();
      if (baseSubscription) {
        baseSubscription.unsubscribe();
      }
      conn.disconnect();
    };
  }, [refreshFromConnection]);

  const actions = useMemo(() => buildActions(connection), [connection]);

  const refresh = useCallback(() => {
    if (!connection) {
      return;
    }
    refreshFromConnection(connection);
  }, [connection, refreshFromConnection]);

  return {
    connection,
    state,
    identity,
    errorMessage,
    snapshot,
    actions,
    refresh,
  };
}
