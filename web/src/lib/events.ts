export interface PostGameCloseStartedPayload {
  dismissAtMicros: bigint;
  seconds: number | null;
}

export interface HostPowerUsedPayload {
  powerId: string;
  durationMs: number | null;
}

export interface EventLike {
  eventId: string;
  matchId: string;
  type: string;
  payloadJson: string;
  atMicros: bigint;
}

export interface HostAccuracySummary {
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface HostPowerActivationSummary {
  eventId: string;
  powerId: string;
  atMicros: bigint;
}

function toDisplayAccuracy(correct: number, attempts: number): number {
  if (attempts <= 0) {
    return 0;
  }
  if (correct >= attempts) {
    return 100;
  }
  return Math.max(0, Math.min(99, Math.round((correct / attempts) * 100)));
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

function parsePayloadObject(payloadJson: string): Record<string, unknown> | null {
  try {
    const payload = JSON.parse(payloadJson) as unknown;
    if (payload && typeof payload === 'object') {
      return payload as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function parsePostGameCloseStartedPayload(
  payloadJson: string
): PostGameCloseStartedPayload | null {
  const payload = parsePayloadObject(payloadJson);
  if (!payload) {
    return null;
  }
  const dismissAtMicros =
    toBigIntOrNull(payload.dismiss_at_micros) ?? toBigIntOrNull(payload.dismissAtMicros);

  if (dismissAtMicros == null) {
    return null;
  }

  return {
    dismissAtMicros,
    seconds: toIntOrNull(payload.seconds),
  };
}

export function parseHostPowerUsedPayload(payloadJson: string): HostPowerUsedPayload | null {
  const payload = parsePayloadObject(payloadJson);
  if (!payload) {
    return null;
  }
  const powerIdRaw = payload.power_id ?? payload.powerId;
  if (typeof powerIdRaw !== 'string') {
    return null;
  }
  const powerId = powerIdRaw.trim();
  if (!powerId) {
    return null;
  }
  return {
    powerId,
    durationMs: toIntOrNull(payload.duration_ms ?? payload.durationMs),
  };
}

export function summarizeHostAccuracy(events: EventLike[], matchId: string): HostAccuracySummary {
  let attempts = 0;
  let correct = 0;
  for (const event of events) {
    if (event.matchId !== matchId) {
      continue;
    }
    if (event.type === 'host_submit_ok') {
      attempts += 1;
      correct += 1;
      continue;
    }
    if (event.type === 'host_submit_bad') {
      attempts += 1;
    }
  }
  return {
    attempts,
    correct,
    accuracy: toDisplayAccuracy(correct, attempts),
  };
}

export function summarizeLatestHostPowerActivation(
  events: EventLike[],
  matchId: string
): HostPowerActivationSummary | null {
  let latest: HostPowerActivationSummary | null = null;
  for (const event of events) {
    if (event.matchId !== matchId || event.type !== 'host_power_used') {
      continue;
    }
    const payload = parseHostPowerUsedPayload(event.payloadJson);
    if (!payload) {
      continue;
    }
    if (
      !latest ||
      event.atMicros > latest.atMicros ||
      (event.atMicros === latest.atMicros && event.eventId > latest.eventId)
    ) {
      latest = {
        eventId: event.eventId,
        powerId: payload.powerId,
        atMicros: event.atMicros,
      };
    }
  }
  return latest;
}
