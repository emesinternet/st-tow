import type { ReactNode } from 'react';
import { Badge } from '@/components/shared/ui/badge';
import { Card } from '@/components/shared/ui/card';
import { formatPhase } from '@/lib/format';
import type { ConnectionState, UiPhase, UiRole } from '@/types/ui';

interface HeaderBarProps {
  connectionState: ConnectionState;
  role: UiRole;
  phase: UiPhase;
  lobbyCode: string;
  lobbyStatus: string;
  controls?: ReactNode;
}

function connectionVariant(state: ConnectionState): 'success' | 'danger' | 'accent' {
  if (state === 'connected') {
    return 'success';
  }
  if (state === 'error' || state === 'disconnected') {
    return 'danger';
  }
  return 'accent';
}

export function HeaderBar({
  connectionState,
  role,
  phase,
  lobbyCode,
  lobbyStatus,
  controls,
}: HeaderBarProps) {
  return (
    <Card className="neo-grid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-black uppercase tracking-wide">Rope Riot</p>
          <p className="font-body text-sm text-neo-muted">Realtime Tug of War</p>
          {lobbyCode ? (
            <p className="mt-1 font-display text-base font-extrabold uppercase tracking-[0.12em] text-neo-ink sm:text-lg">
              Lobby {lobbyCode}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-[260px] flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant={connectionVariant(connectionState)}>{connectionState}</Badge>
            <Badge variant="accent">Phase {formatPhase(phase)}</Badge>
            {lobbyStatus ? <Badge variant="info">{lobbyStatus}</Badge> : null}
            <Badge variant="neutral">Role {role}</Badge>
          </div>
          {controls ? <div className="flex justify-end">{controls}</div> : null}
        </div>
      </div>
    </Card>
  );
}
