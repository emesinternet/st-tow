import { TeamRosterCard } from '@/components/shared/TeamRosterCard';
import type { LobbyViewModel } from '@/types/ui';

interface LobbyOverviewProps {
  lobby: LobbyViewModel;
}

export function LobbyOverview({ lobby }: LobbyOverviewProps) {
  return (
    <div className="space-y-4">
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
