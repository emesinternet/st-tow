const PHASE_LABELS: Record<string, string> = {
  PreGame: 'Pre-Game',
  InGame: 'In Match',
  SuddenDeath: 'Sudden Death',
  PostGame: 'Post Game',
};

const STATUS_LABELS: Record<string, string> = {
  Waiting: 'Waiting',
  Running: 'Running',
  SuddenDeath: 'Sudden Death',
  Finished: 'Finished',
};

export function formatPhase(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function formatLobbyStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatSeconds(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) {
    return '--';
  }
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const remaining = clamped % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function formatEventPayload(payloadJson: string): string {
  if (!payloadJson) {
    return '';
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
  } catch {
    return payloadJson;
  }
}

export function formatEventTime(atMicros: bigint): string {
  if (atMicros <= 0n) {
    return '--:--:--';
  }
  const millis = Number(atMicros / 1000n);
  if (!Number.isFinite(millis)) {
    return '--:--:--';
  }
  const date = new Date(millis);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
