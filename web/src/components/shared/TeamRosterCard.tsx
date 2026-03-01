import { Badge } from '@/components/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import type { TeamCountViewModel, TeamPlayerViewModel } from '@/types/ui';

interface TeamRosterCardProps {
  title: string;
  badgeVariant: 'teamA' | 'teamB';
  players: TeamPlayerViewModel[];
  counts: TeamCountViewModel;
}

export function TeamRosterCard({ title, badgeVariant, players, counts }: TeamRosterCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="mb-2 flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Badge variant={badgeVariant}>{counts.active} Active</Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <Badge variant="neutral">Total {counts.total}</Badge>
          <Badge variant="danger">Out {counts.eliminated}</Badge>
          <Badge variant="info">Left {counts.left}</Badge>
        </div>
        <ul className="space-y-2">
          {players.length === 0 ? (
            <li className="font-body text-sm text-neo-muted">No players yet.</li>
          ) : (
            players.map((player) => (
              <li
                key={player.playerId}
                className="rounded-[10px] border-4 border-neo-ink bg-white px-3 py-2 shadow-neo-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-body text-sm font-semibold">
                    {player.displayName}
                    {player.isYou ? ' (You)' : ''}
                  </div>
                  <Badge
                    variant={
                      player.status === 'Active'
                        ? 'success'
                        : player.status === 'Eliminated'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {player.status}
                  </Badge>
                </div>
                {player.eliminatedReason ? (
                  <p className="mt-1 font-mono text-xs text-neo-muted">
                    reason={player.eliminatedReason}
                  </p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
