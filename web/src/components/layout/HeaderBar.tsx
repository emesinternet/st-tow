import { PanelRightOpen } from 'lucide-react';
import { Badge } from '@/components/shared/ui/badge';
import { Button } from '@/components/shared/ui/button';
import { Card } from '@/components/shared/ui/card';
import { formatPhase } from '@/lib/format';
import type { ConnectionState, UiPhase, UiRole } from '@/types/ui';

interface HeaderBarProps {
  connectionState: ConnectionState;
  role: UiRole;
  phase: UiPhase;
  lobbyCode: string;
  lobbyStatus: string;
  onOpenPanels: () => void;
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
  onOpenPanels,
}: HeaderBarProps) {
  return (
    <Card className="neo-grid">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-black uppercase tracking-wide">Rope Riot</p>
          <p className="font-body text-sm text-neo-muted">Realtime Tug of War</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={connectionVariant(connectionState)}>{connectionState}</Badge>
          <Badge variant="accent">Phase {formatPhase(phase)}</Badge>
          {lobbyCode ? <Badge variant="neutral">Code {lobbyCode}</Badge> : null}
          {lobbyStatus ? <Badge variant="info">{lobbyStatus}</Badge> : null}
          <Badge variant="neutral">Role {role}</Badge>
          <Button
            size="sm"
            variant="neutral"
            className="lg:hidden"
            type="button"
            onClick={onOpenPanels}
          >
            <PanelRightOpen className="h-4 w-4" />
            Panels
          </Button>
        </div>
      </div>
    </Card>
  );
}
