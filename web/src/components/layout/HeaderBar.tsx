import type { ReactNode } from 'react';
import { Badge } from '@/components/shared/ui/badge';
import { Card } from '@/components/shared/ui/card';
import type { ConnectionState } from '@/types/ui';

interface HeaderBarProps {
  connectionState: ConnectionState;
  lobbyStatus: string;
  musicControls?: ReactNode;
  controls?: ReactNode;
}

function connectionVariant(state: ConnectionState): 'success' | 'danger' {
  if (state === 'connected') {
    return 'success';
  }
  return 'danger';
}

function connectionLabel(state: ConnectionState): string {
  return state === 'connected' ? 'Online' : 'Offline';
}

export function HeaderBar({
  connectionState,
  lobbyStatus,
  musicControls,
  controls,
}: HeaderBarProps) {
  return (
    <Card className="neo-grid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-[3rem] leading-[3rem] font-black uppercase tracking-wide">
            Typing Fever!
          </p>
          <p className="font-body text-sm text-neo-muted">Realtime Typing Tug of War</p>
        </div>

        <div className="flex min-w-[260px] flex-col items-end gap-4">
          {musicControls ? (
            <div className="flex flex-wrap items-center justify-end gap-2">{musicControls}</div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant={connectionVariant(connectionState)}>{connectionLabel(connectionState)}</Badge>
            {lobbyStatus ? <Badge variant="info">{lobbyStatus}</Badge> : null}
          </div>
          {controls ? <div className="flex justify-end">{controls}</div> : null}
        </div>
      </div>
    </Card>
  );
}
