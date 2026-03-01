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
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div>
          <p className="font-display text-4xl leading-[0.95] font-black uppercase tracking-wide sm:text-5xl lg:text-6xl">
            Typing Fever!
          </p>
          <p className="font-body text-base leading-tight text-neo-muted sm:text-lg">
            Realtime Multi-player Typing Tug of War
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col items-start gap-[var(--space-4)] sm:w-auto sm:min-w-[260px] sm:items-end">
          {musicControls ? (
            <div className="flex w-full flex-wrap items-center justify-start gap-[var(--space-2)] sm:justify-end">
              {musicControls}
            </div>
          ) : null}
          <div className="flex w-full flex-wrap items-center justify-start gap-[var(--space-2)] sm:justify-end">
            <Badge variant={connectionVariant(connectionState)}>
              {connectionLabel(connectionState)}
            </Badge>
          </div>
        </div>
      </div>
      {lobbyCode ? (
        <div className="absolute bottom-0 left-1/2 z-40 -translate-x-1/2 translate-y-1/2">
          <button
            type="button"
            className="neo-focus cursor-pointer select-text rounded-[var(--ui-radius-md)] border-4 border-neo-ink bg-neo-yellow px-5 py-1 font-display text-[var(--ui-text-lg)] font-black tracking-[0.18em] text-neo-ink shadow-neo transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-pressed sm:text-2xl"
            title="Copy lobby code"
            aria-label={`Copy lobby code ${lobbyCode}`}
            onClick={() => {
              onCopyLobbyCode?.();
            }}
          >
            {lobbyCode}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
