export interface PostGameCloseStartedPayload {
  dismissAtMicros: bigint;
  seconds: number | null;
}

function toBigIntOrNull(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function toIntOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

export function parsePostGameCloseStartedPayload(
  payloadJson: string
): PostGameCloseStartedPayload | null {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const dismissAtMicros =
      toBigIntOrNull(payload.dismiss_at_micros) ?? toBigIntOrNull(payload.dismissAtMicros);

    if (dismissAtMicros == null) {
      return null;
    }

    return {
      dismissAtMicros,
      seconds: toIntOrNull(payload.seconds),
    };
  } catch {
    return null;
  }
}
