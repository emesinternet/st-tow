import { Badge } from '@/components/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { TeamRosterCard } from '@/components/shared/TeamRosterCard';
import { formatLobbyStatus } from '@/lib/format';
import type { LobbyViewModel } from '@/types/ui';

interface LobbyOverviewProps {
  lobby: LobbyViewModel;
}

export function LobbyOverview({ lobby }: LobbyOverviewProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-neo-yellow/70">
        <CardHeader className="mb-0 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lobby Code</CardTitle>
          <Badge variant="info">{formatLobbyStatus(lobby.status)}</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="font-display text-4xl font-black tracking-[0.12em]">{lobby.joinCode}</p>
            <p className="font-body text-sm text-neo-muted">Share this code with players.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <TeamRosterCard
          title="Team A"
          badgeVariant="teamA"
          players={lobby.teamA}
          counts={lobby.teamACounts}
        />
        <TeamRosterCard
          title="Team B"
          badgeVariant="teamB"
          players={lobby.teamB}
          counts={lobby.teamBCounts}
        />
      </div>
    </div>
  );
}
