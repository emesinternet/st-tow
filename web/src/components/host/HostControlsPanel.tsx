import { Badge } from '@/components/shared/ui/badge';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import type { HostPanelViewModel, LobbyViewModel, MatchHudViewModel } from '@/types/ui';

interface HostControlsPanelProps {
  lobby: LobbyViewModel | null;
  hud: MatchHudViewModel | null;
  hostPanel: HostPanelViewModel | null;
  onStartMatch: () => Promise<void>;
  onResetLobby: () => Promise<void>;
  onEndMatch: () => Promise<void>;
  variant?: 'card' | 'inline';
}

export function HostControlsPanel({
  lobby,
  hud,
  hostPanel,
  onStartMatch,
  onResetLobby,
  onEndMatch,
  variant = 'card',
}: HostControlsPanelProps) {
  const canStart = hostPanel?.canStart ?? false;
  const canReset = hostPanel?.canReset ?? false;
  const canEndMatch = hostPanel?.canEndMatch ?? false;

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="teamB"
          disabled={!canStart}
          onClick={() => void onStartMatch()}
        >
          Start
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={!canEndMatch}
          onClick={() => void onEndMatch()}
        >
          End
        </Button>
        <Button
          type="button"
          size="sm"
          variant="neutral"
          disabled={!canReset}
          onClick={() => void onResetLobby()}
        >
          Reset
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Host Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">Lobby {lobby?.status ?? 'none'}</Badge>
          <Badge variant="accent">Role Panel</Badge>
          {hud ? <Badge variant="info">Match {hud.phase}</Badge> : null}
        </div>

        <div className="grid gap-2">
          <Button
            type="button"
            variant="teamB"
            disabled={!canStart}
            onClick={() => void onStartMatch()}
          >
            Start Match
          </Button>
          {!canStart && hostPanel?.startDisabledReason ? (
            <p className="font-body text-xs text-neo-muted">{hostPanel.startDisabledReason}</p>
          ) : null}

          <Button
            type="button"
            variant="danger"
            disabled={!canEndMatch}
            onClick={() => void onEndMatch()}
          >
            End Match
          </Button>
          {!canEndMatch && hostPanel?.endDisabledReason ? (
            <p className="font-body text-xs text-neo-muted">{hostPanel.endDisabledReason}</p>
          ) : null}

          <Button
            type="button"
            variant="neutral"
            disabled={!canReset}
            onClick={() => void onResetLobby()}
          >
            Reset Lobby
          </Button>
          {!canReset && hostPanel?.resetDisabledReason ? (
            <p className="font-body text-xs text-neo-muted">{hostPanel.resetDisabledReason}</p>
          ) : null}

        </div>
      </CardContent>
    </Card>
  );
}
