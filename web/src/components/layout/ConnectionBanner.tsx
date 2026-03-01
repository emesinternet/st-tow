import { Badge } from '@/components/shared/ui/badge';
import { Card } from '@/components/shared/ui/card';
import type { ConnectionState } from '@/types/ui';

interface ConnectionBannerProps {
  state: ConnectionState;
  errorMessage: string | null;
}

export function ConnectionBanner({ state, errorMessage }: ConnectionBannerProps) {
  if (state === 'connected') {
    return null;
  }

  const copy =
    state === 'connecting'
      ? 'Connecting to SpacetimeDB...'
      : state === 'disconnected'
        ? 'Reconnecting to server. Realtime updates are paused.'
        : `Connection error: ${errorMessage ?? 'Unknown error'}`;
  const badgeLabel = state === 'disconnected' ? 'OFFLINE' : state;

  return (
    <Card className="mb-4 border-neo-danger bg-neo-yellow/75">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-sm font-semibold text-neo-ink">{copy}</p>
        <Badge variant={state === 'error' || state === 'disconnected' ? 'danger' : 'accent'}>
          {badgeLabel}
        </Badge>
      </div>
    </Card>
  );
}
