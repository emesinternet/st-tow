import { Badge } from '@/components/shared/ui/badge';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import type {
  LobbyViewModel,
  MatchHudViewModel,
  TeamPlayerViewModel,
  UiRole,
} from '@/types/ui';

interface PostGameStatsModalProps {
  open: boolean;
  onClose: () => void;
  onResetMatch: () => Promise<void>;
  onDebugConfetti: () => void;
  role: UiRole;
  lobby: LobbyViewModel | null;
  hud: MatchHudViewModel | null;
  waitingForHostSeconds: number | null;
}

function teamLabel(team: string): string {
  if (team === 'A') {
    return 'Red Team';
  }
  if (team === 'B') {
    return 'Blue Team';
  }
  return team;
}

function playerRows(lobby: LobbyViewModel): TeamPlayerViewModel[] {
  return [...lobby.teamA, ...lobby.teamB].sort((left, right) => {
    if (left.correctCount !== right.correctCount) {
      return right.correctCount - left.correctCount;
    }
    if (left.accuracy !== right.accuracy) {
      return right.accuracy - left.accuracy;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

export function PostGameStatsModal({
  open,
  onClose,
  onResetMatch,
  onDebugConfetti,
  role,
  lobby,
  hud,
  waitingForHostSeconds,
}: PostGameStatsModalProps) {
  if (!open || !lobby) {
    return null;
  }

  const teamASuccessful = lobby.teamA.reduce((total, player) => total + player.correctCount, 0);
  const teamBSuccessful = lobby.teamB.reduce((total, player) => total + player.correctCount, 0);
  const hostSuccessful = Math.max(0, hud?.hostSuccessfulWords ?? 0);
  const rows = playerRows(lobby);
  const visibleRowCount = Math.max(1, Math.min(10, rows.length));
  const tableMaxHeightPx = 42 + visibleRowCount * 36;
  const winnerLabel =
    hud?.winnerTeam === 'A' ? 'Red Team' : hud?.winnerTeam === 'B' ? 'Blue Team' : 'No winner';

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-neo-ink/45 p-3">
      <Card className="relative z-[87] w-full max-w-5xl">
        <CardContent className="space-y-3">
          <p className="text-center font-display text-3xl font-black uppercase tracking-wide text-neo-ink sm:text-5xl">
            Winner: {winnerLabel}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[12px] border-2 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-neo-teamA">
                Red Team Successful Words
              </p>
              <p className="font-display text-2xl font-black">{teamASuccessful}</p>
            </div>
            <div className="rounded-[12px] border-2 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-neo-teamB">
                Blue Team Successful Words
              </p>
              <p className="font-display text-2xl font-black">{teamBSuccessful}</p>
            </div>
            <div className="rounded-[12px] border-2 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-neo-ink">
                Host Successful Words
              </p>
              <p className="font-display text-2xl font-black">{hostSuccessful}</p>
            </div>
          </div>

          <div
            className="overflow-auto rounded-[12px] border-2 border-neo-ink"
            style={{ maxHeight: `${tableMaxHeightPx}px` }}
          >
            <table className="w-full border-collapse text-left">
              <thead className="bg-neo-yellow/50">
                <tr>
                  <th className="border-b-2 border-neo-ink px-3 py-1.5 font-display text-xs font-black uppercase tracking-wide">Player</th>
                  <th className="border-b-2 border-neo-ink px-3 py-1.5 font-display text-xs font-black uppercase tracking-wide">Team</th>
                  <th className="border-b-2 border-neo-ink px-3 py-1.5 text-right font-display text-xs font-black uppercase tracking-wide">Accuracy</th>
                  <th className="border-b-2 border-neo-ink px-3 py-1.5 text-right font-display text-xs font-black uppercase tracking-wide">Successful</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(player => (
                  <tr key={player.playerId} className="odd:bg-neo-paper even:bg-neo-paper/75">
                    <td className="px-3 py-1.5 font-body text-sm font-semibold">{player.displayName}</td>
                    <td className="px-3 py-1.5 font-body text-sm">
                      <Badge variant={player.team === 'A' ? 'teamA' : player.team === 'B' ? 'teamB' : 'neutral'}>
                        {teamLabel(player.team)}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-sm">{player.accuracy}%</td>
                    <td className="px-3 py-1.5 text-right font-mono text-sm">{player.correctCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {role === 'host' ? (
            <div className="flex justify-center gap-2 pt-1">
              <Button type="button" size="sm" variant="neutral" onClick={onClose}>
                Close
              </Button>
              <Button type="button" size="sm" variant="neutral" onClick={onDebugConfetti}>
                DBG Confetti
              </Button>
              <Button
                type="button"
                size="sm"
                variant="teamB"
                onClick={() => {
                  void onResetMatch();
                }}
              >
                Reset Match
              </Button>
            </div>
          ) : (
            <p className="pt-1 text-center font-display text-sm font-black uppercase tracking-wide text-neo-muted">
              {waitingForHostSeconds == null
                ? 'Waiting for host'
                : `Lobby closing in ${waitingForHostSeconds}`}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
