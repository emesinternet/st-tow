import { memo } from 'react';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import type { HostPanelViewModel, LobbyViewModel, MatchHudViewModel } from '@/types/ui';

interface HostControlsPanelProps {
  lobby: LobbyViewModel | null;
  hud: MatchHudViewModel | null;
  hostPanel: HostPanelViewModel | null;
  cameraEnabled: boolean;
  cameraToggleEnabled: boolean;
  cameraBusy: boolean;
  onStartMatch: () => Promise<void>;
  onResetLobby: () => Promise<void>;
  onEndMatch: () => Promise<void>;
  onSetCameraEnabled: (enabled: boolean) => Promise<void>;
}

export const HostControlsPanel = memo(function HostControlsPanel({
  lobby,
  hud,
  hostPanel,
  cameraEnabled,
  cameraToggleEnabled,
  cameraBusy,
  onStartMatch,
  onResetLobby,
  onEndMatch,
  onSetCameraEnabled,
}: HostControlsPanelProps) {
  const canStart = hostPanel?.canStart ?? false;
  const canReset = hostPanel?.canReset ?? false;
  const canEndMatch = hostPanel?.canEndMatch ?? false;
  const canToggleCamera = cameraToggleEnabled;
  const isMatchInProgress =
    lobby?.status === 'Running' ||
    lobby?.status === 'SuddenDeath' ||
    hud?.phase === 'PreGame' ||
    hud?.phase === 'InGame' ||
    hud?.phase === 'SuddenDeath' ||
    hud?.phase === 'TieBreakRps';

  return (
    <Card>
      <CardHeader className="mb-1">
        <CardTitle>Host Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
          <Button
            type="button"
            variant={cameraEnabled ? 'teamB' : 'neutral'}
            className="w-full"
            disabled={!canToggleCamera || cameraBusy}
            onClick={() => {
              void onSetCameraEnabled(!cameraEnabled);
            }}
            title={hostPanel?.cameraDisabledReason ?? undefined}
          >
            {cameraBusy ? 'Camera...' : cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
          </Button>
          <Button
            type="button"
            variant="neutral"
            className="w-full"
            disabled={!canReset}
            onClick={() => void onResetLobby()}
          >
            Reset Lobby
          </Button>
          <Button
            type="button"
            variant={isMatchInProgress ? 'danger' : 'neutral'}
            className={`w-full ${isMatchInProgress ? '' : 'bg-neo-success text-neo-paper'}`}
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
        </div>
      </CardContent>
    </Card>
  );
});
