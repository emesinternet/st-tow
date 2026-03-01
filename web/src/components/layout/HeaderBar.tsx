import type { ReactNode } from 'react';
import { Badge } from '@/components/shared/ui/badge';
import { Card } from '@/components/shared/ui/card';
import type { ConnectionState } from '@/types/ui';

interface HeaderBarProps {
  connectionState: ConnectionState;
  lobbyCode?: string;
  onCopyLobbyCode?: () => void;
  musicControls?: ReactNode;
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
  lobbyCode,
  onCopyLobbyCode,
  musicControls,
}: HeaderBarProps) {
  return (
    <Card className="neo-grid relative overflow-visible">
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
          </div>
        </div>
      </div>
      {lobbyCode ? (
        <Badge
          variant="accent"
          className="absolute bottom-0 left-1/2 z-40 -translate-x-1/2 translate-y-1/2 cursor-pointer select-text rounded-[12px] border-4 px-5 py-1 text-xl font-black tracking-[0.18em] sm:text-2xl"
          role="button"
          tabIndex={0}
          title="Copy lobby code"
          onClick={() => {
            onCopyLobbyCode?.();
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onCopyLobbyCode?.();
            }
          }}
        >
          {lobbyCode}
        </Badge>
      ) : null}
    </Card>
  );
}
