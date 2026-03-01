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
}

export function HostControlsPanel({
  lobby,
  hud,
  hostPanel,
  onStartMatch,
  onResetLobby,
  onEndMatch,
}: HostControlsPanelProps) {
  const canStart = hostPanel?.canStart ?? false;
  const canReset = hostPanel?.canReset ?? false;
  const canEndMatch = hostPanel?.canEndMatch ?? false;
  const isMatchInProgress =
    lobby?.status === 'Running' ||
    lobby?.status === 'SuddenDeath' ||
    hud?.phase === 'PreGame' ||
    hud?.phase === 'InGame' ||
    hud?.phase === 'SuddenDeath' ||
    hud?.phase === 'TieBreakRps';

  return (
    <Card>
      <CardHeader className="mb-2 flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-lg">Host Controls</CardTitle>
        {lobby?.status ? <Badge variant="info">{lobby.status}</Badge> : null}
      </CardHeader>
      <CardContent>
        <div className="flex flex-nowrap items-center gap-2">
          <Button
            type="button"
            variant={isMatchInProgress ? 'danger' : 'teamB'}
            className="min-w-0 flex-1"
            disabled={isMatchInProgress ? !canEndMatch : !canStart}
            onClick={() => {
              if (isMatchInProgress) {
                void onEndMatch();
                return;
              }
              void onStartMatch();
            }}
          >
            {isMatchInProgress ? 'End Match' : 'Start Match'}
          </Button>
          <Button
            type="button"
            variant="neutral"
            className="shrink-0"
            disabled={!canReset}
            onClick={() => void onResetLobby()}
          >
            Reset Lobby
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
