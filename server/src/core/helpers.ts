import type { Identity } from 'spacetimedb';
import type { ReducerCtx } from 'spacetimedb/server';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newId(ctx: ReducerCtx<any>, prefix: string): string {
  return `${prefix}_${ctx.newUuidV7().toString()}`;
}

export function nowMicros(ctx: ReducerCtx<any>): bigint {
  return ctx.timestamp.microsSinceUnixEpoch;
}

export function msToMicros(ms: number): bigint {
  return BigInt(ms) * 1000n;
}

export function makeJoinCode(ctx: ReducerCtx<any>, length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = ctx.random.integerInRange(0, JOIN_CODE_ALPHABET.length - 1);
    result += JOIN_CODE_ALPHABET[idx];
  }
  return result;
}

export function normalizeDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) {
    return 'Player';
  }
  if (trimmed.length > 24) {
    return trimmed.slice(0, 24);
  }
  return trimmed;
}

export function settingId(lobbyId: string, key: string): string {
  return `${lobbyId}:${key}`;
}

export function scheduleId(matchId: string, kind: string): string {
  return `${matchId}:${kind}`;
}

export function tugPlayerStateId(matchId: string, playerId: string): string {
  return `${matchId}:${playerId}`;
}

export function lobbyIdentityKey(lobbyId: string, identity: Identity): string {
  return `${lobbyId}:${identity.toHexString()}`;
}

export function parseNumberJson(valueJson: string): number | null {
  try {
    const parsed = JSON.parse(valueJson);
    const asNumber = Number(parsed);
    if (Number.isFinite(asNumber)) {
      return Math.trunc(asNumber);
    }
  } catch {
    const asNumber = Number(valueJson);
    if (Number.isFinite(asNumber)) {
      return Math.trunc(asNumber);
    }
  }
  return null;
}
