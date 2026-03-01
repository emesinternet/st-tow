import type { ReactNode } from 'react';
import { Card } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';

interface HeaderBarProps {
  lobbyCode?: string;
  onCopyLobbyCode?: () => void;
  onLeaveLobby?: () => void;
  musicControls?: ReactNode;
}

export function HeaderBar({
  lobbyCode,
  onCopyLobbyCode,
  onLeaveLobby,
  musicControls,
}: HeaderBarProps) {
  return (
    <Card className="neo-grid">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div>
          <p className="font-display text-4xl leading-[0.95] font-black uppercase tracking-wide sm:text-5xl">
            Typing Fever!
          </p>
          <p className="font-body text-base leading-tight text-neo-muted sm:text-lg">
            Realtime Multi-player Typing Tug of War
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:min-w-[260px] sm:items-end">
          {musicControls ? (
            <div className="flex flex-wrap items-center justify-end gap-[var(--space-2)]">
              {musicControls}
            </div>
          ) : null}
          {lobbyCode ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="default"
                className="select-text tracking-[0.18em]"
                title="Copy lobby code"
                aria-label={`Copy lobby code ${lobbyCode}`}
                onClick={() => {
                  onCopyLobbyCode?.();
                }}
              >
                {lobbyCode}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                className="text-neo-paper"
                onClick={() => {
                  onLeaveLobby?.();
                }}
              >
                Leave Lobby
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
