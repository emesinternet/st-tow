import * as moduleBindings from '../../../web/src/module_bindings/index.ts';

type DbConnection = {
  reducers: unknown;
  disconnect: () => void;
};

type DbConnectionBuilder = {
  withUri: (uri: string) => DbConnectionBuilder;
  withDatabaseName: (databaseName: string) => DbConnectionBuilder;
  withToken: (token: string | undefined) => DbConnectionBuilder;
  onConnect: (
    callback: (
      ctx: DbConnection,
      identity: { toHexString?: () => string } | undefined,
      token: string | undefined
    ) => void
  ) => DbConnectionBuilder;
  onDisconnect: (callback: () => void) => DbConnectionBuilder;
  onConnectError: (
    callback: (_ctx: unknown, error: { message: string }) => void
  ) => DbConnectionBuilder;
  build: () => DbConnection;
};

function resolveDbConnectionClass(): { builder: () => DbConnectionBuilder } {
  const bindings = moduleBindings as unknown as {
    DbConnection?: { builder?: () => DbConnectionBuilder };
    default?: { DbConnection?: { builder?: () => DbConnectionBuilder } };
  };

  const candidate = bindings.DbConnection ?? bindings.default?.DbConnection;
  if (!candidate?.builder) {
    throw new Error(
      'Unable to resolve DbConnection from web module bindings. Expected DbConnection export.'
    );
  }
  return candidate;
}

const DbConnectionClass = resolveDbConnectionClass();

export interface BotConnectionStats {
  disconnects: number;
  reconnects: number;
}

type ReducerFn = (params: Record<string, unknown>) => Promise<void>;
type ReducerBag = Record<string, ReducerFn | undefined>;

function normalizeIdentityHex(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
}

function identityToHex(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return normalizeIdentityHex(value);
  }

  if (typeof value === 'object') {
    const maybeIdentity = value as {
      toHexString?: () => string;
      toString?: () => string;
    };

    if (typeof maybeIdentity.toHexString === 'function') {
      return normalizeIdentityHex(maybeIdentity.toHexString());
    }

    if (typeof maybeIdentity.toString === 'function') {
      const asString = maybeIdentity.toString();
      if (asString && asString !== '[object Object]') {
        return normalizeIdentityHex(asString);
      }
    }
  }

  return normalizeIdentityHex(String(value));
}

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

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function nextDelayMs(random: () => number, minMs: number, maxMs: number): number {
  if (maxMs <= minMs) {
    return minMs;
  }

  const spread = maxMs - minMs;
  return minMs + Math.floor(random() * (spread + 1));
}

export function shouldVoteInRound(
  stage: string,
  lastVotedRound: number,
  roundNumber: number
): boolean {
  return stage === 'Voting' && roundNumber > 0 && roundNumber !== lastVotedRound;
}

export class BotClient {
  private readonly botId: string;
  private readonly displayName: string;
  private readonly host: string;
  private readonly dbName: string;

  private connection: DbConnection | null = null;
  private token: string | undefined;
  private identityHex = '';
  private connected = false;
  private hasConnectedAtLeastOnce = false;

  private stats: BotConnectionStats = {
    disconnects: 0,
    reconnects: 0,
  };

  constructor(botId: string, displayName: string, host: string, dbName: string) {
    this.botId = botId;
    this.displayName = displayName;
    this.host = host;
    this.dbName = dbName;
  }

  get id(): string {
    return this.botId;
  }

  get name(): string {
    return this.displayName;
  }

  get identity(): string {
    return this.identityHex;
  }

  get connectionStats(): BotConnectionStats {
    return this.stats;
  }

  private buildConnection(resolve: () => void, reject: (error: Error) => void): DbConnection {
    let settled = false;

    const builder = DbConnectionClass.builder()
      .withUri(this.host)
      .withDatabaseName(this.dbName)
      .withToken(this.token)
      .onConnect((_ctx, identity, token) => {
        this.connected = true;

        if (token) {
          this.token = token;
        }

        const identityHex = identityToHex(identity);
        if (identityHex) {
          this.identityHex = identityHex;
        }

        if (this.hasConnectedAtLeastOnce) {
          this.stats.reconnects += 1;
        }
        this.hasConnectedAtLeastOnce = true;

        if (!settled) {
          settled = true;
          resolve();
        }
      })
      .onDisconnect(() => {
        if (this.connected) {
          this.stats.disconnects += 1;
        }
        this.connected = false;
      })
      .onConnectError((_ctx, error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(`Bot ${this.botId} failed to connect: ${error.message}`));
      });

    return (builder as DbConnectionBuilder).build();
  }

  async connect(): Promise<void> {
    if (this.connected && this.connection) {
      return;
    }

    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
      await waitFor(20);
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Bot ${this.botId} connection timed out.`));
      }, 12_000);

      this.connection = this.buildConnection(
        () => {
          clearTimeout(timeout);
          resolve();
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    });
  }

  private async ensureConnected(): Promise<DbConnection> {
    if (!this.connected || !this.connection) {
      await this.connect();
    }

    if (!this.connection) {
      throw new Error(`Bot ${this.botId} has no active connection.`);
    }

    return this.connection;
  }

  async joinLobby(joinCode: string): Promise<void> {
    const connection = await this.ensureConnected();
    await callReducer(connection, 'join_lobby', {
      joinCode,
      displayName: this.displayName,
    });
  }

  async submitWord(matchId: string, wordVersion: number, typed: string): Promise<void> {
    const connection = await this.ensureConnected();
    await callReducer(connection, 'tug_submit', {
      matchId,
      wordVersion,
      typed,
    });
  }

  async castRpsVote(matchId: string, choice: 'rock' | 'paper' | 'scissors'): Promise<void> {
    const connection = await this.ensureConnected();
    await callReducer(connection, 'tug_rps_cast_vote', {
      matchId,
      choice,
    });
  }

  disconnect(): void {
    if (!this.connection) {
      return;
    }
    this.connection.disconnect();
    this.connection = null;
    this.connected = false;
  }
}
