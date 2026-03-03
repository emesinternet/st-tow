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
  lobbyId: string;
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

export interface LatestPostGameCloseSummary {
  eventId: string;
  atMicros: bigint;
  dismissAtMicros: bigint;
  seconds: number | null;
}

export interface MatchEventFactsSummary {
  hostAccuracy: HostAccuracySummary;
  latestHostPowerActivation: HostPowerActivationSummary | null;
  latestPostGameClose: LatestPostGameCloseSummary | null;
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

function isNewerEvent(
  event: Pick<EventLike, 'atMicros' | 'eventId'>,
  current: Pick<EventLike, 'atMicros' | 'eventId'> | null
): boolean {
  if (!current) {
    return true;
  }
  if (event.atMicros > current.atMicros) {
    return true;
  }
  return event.atMicros === current.atMicros && event.eventId > current.eventId;
}

export function summarizeMatchEventFacts(
  events: EventLike[],
  options: {
    matchId: string;
    lobbyId: string;
  }
): MatchEventFactsSummary {
  const { matchId, lobbyId } = options;
  let hostAttempts = 0;
  let hostCorrect = 0;
  let latestHostPowerActivation: HostPowerActivationSummary | null = null;
  let latestPostGameClose: LatestPostGameCloseSummary | null = null;

  for (const event of events) {
    if (event.matchId === matchId) {
      if (event.type === 'host_submit_ok') {
        hostAttempts += 1;
        hostCorrect += 1;
      } else if (event.type === 'host_submit_bad') {
        hostAttempts += 1;
      } else if (event.type === 'host_power_used') {
        const payload = parseHostPowerUsedPayload(event.payloadJson);
        if (!payload) {
          continue;
        }
        if (isNewerEvent(event, latestHostPowerActivation)) {
          latestHostPowerActivation = {
            eventId: event.eventId,
            powerId: payload.powerId,
            atMicros: event.atMicros,
          };
        }
      }
    }

    if (event.lobbyId !== lobbyId || event.type !== 'postgame_close_started') {
      continue;
    }
    if (matchId && event.matchId && event.matchId !== matchId) {
      continue;
    }
    const payload = parsePostGameCloseStartedPayload(event.payloadJson);
    if (!payload) {
      continue;
    }
    if (isNewerEvent(event, latestPostGameClose)) {
      latestPostGameClose = {
        eventId: event.eventId,
        atMicros: event.atMicros,
        dismissAtMicros: payload.dismissAtMicros,
        seconds: payload.seconds,
      };
    }
  }

  return {
    hostAccuracy: {
      attempts: hostAttempts,
      correct: hostCorrect,
      accuracy: toDisplayAccuracy(hostCorrect, hostAttempts),
    },
    latestHostPowerActivation,
    latestPostGameClose,
  };
}
