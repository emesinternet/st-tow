import { useId } from 'react';
import { Badge } from '@/components/shared/ui/badge';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import type { LobbyViewModel, MatchHudViewModel, TeamPlayerViewModel, UiRole } from '@/types/ui';

interface PostGameStatsModalProps {
  open: boolean;
  onClose: () => void;
  onResetMatch: () => Promise<void>;
  role: UiRole;
  lobby: LobbyViewModel | null;
  hud: MatchHudViewModel | null;
  waitingForHostSeconds: number | null;
}

interface LeaderboardRow {
  rowId: string;
  displayName: string;
  team: string;
  accuracy: number | null;
  correctCount: number;
  isHost: boolean;
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

function leaderboardRows(
  lobby: LobbyViewModel,
  hostSuccessful: number,
  hostAccuracy: number | null
): LeaderboardRow[] {
  const hostRow: LeaderboardRow = {
    rowId: '__host__',
    displayName: 'Host',
    team: 'HOST',
    accuracy: hostAccuracy,
    correctCount: hostSuccessful,
    isHost: true,
  };
  const players = playerRows(lobby).map<LeaderboardRow>((player) => ({
    rowId: player.playerId,
    displayName: player.displayName,
    team: player.team,
    accuracy: player.accuracy,
    correctCount: player.correctCount,
    isHost: false,
  }));
  return [hostRow, ...players];
}

export function PostGameStatsModal({
  open,
  onClose,
  onResetMatch,
  role,
  lobby,
  hud,
  waitingForHostSeconds,
}: PostGameStatsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  if (!open || !lobby) {
    return null;
  }

  const teamASuccessful = lobby.teamA.reduce((total, player) => total + player.correctCount, 0);
  const teamBSuccessful = lobby.teamB.reduce((total, player) => total + player.correctCount, 0);
  const hostSuccessful = Math.max(0, hud?.hostSuccessfulWords ?? 0);
  const hostAccuracy = null;
  const rows = leaderboardRows(lobby, hostSuccessful, hostAccuracy);
  const hasRows = rows.length > 0;
  const visibleRowCount = Math.max(1, Math.min(10, rows.length));
  const tableMaxHeightPx = 42 + visibleRowCount * 36;
  const winnerLabel =
    hud?.winnerTeam === 'A' ? 'Red Team' : hud?.winnerTeam === 'B' ? 'Blue Team' : 'No winner';

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-neo-ink/45 p-3">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-[87] w-full max-w-5xl"
      >
        <CardContent className="space-y-3">
          <p
            id={titleId}
            className="text-center font-display text-3xl font-black uppercase tracking-wide text-neo-ink sm:text-5xl"
          >
            Winner: {winnerLabel}
          </p>
          <p id={descriptionId} className="sr-only">
            Post game statistics and match results.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[12px] border-4 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-neo-teamA">
                Red Team Words
              </p>
              <p className="font-display text-2xl font-black">{teamASuccessful}</p>
            </div>
            <div className="rounded-[12px] border-4 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-neo-teamB">
                Blue Team Words
              </p>
              <p className="font-display text-2xl font-black">{teamBSuccessful}</p>
            </div>
            <div className="rounded-[12px] border-4 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
              <p className="font-display text-xs font-bold uppercase tracking-wide text-neo-ink">
                Host Words
              </p>
              <p className="font-display text-2xl font-black">{hostSuccessful}</p>
            </div>
          </div>

          <div
            className={`rounded-[12px] border-4 border-neo-ink shadow-neo-sm ${hasRows ? 'overflow-auto' : 'overflow-hidden'}`}
            style={hasRows ? { maxHeight: `${tableMaxHeightPx}px` } : undefined}
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 border-b-2 border-neo-ink bg-neo-yellow px-3 py-1.5 font-display text-xs font-black uppercase tracking-wide">
                    Player
                  </th>
                  <th className="sticky top-0 z-10 border-b-2 border-neo-ink bg-neo-yellow px-3 py-1.5 font-display text-xs font-black uppercase tracking-wide">
                    Team
                  </th>
                  <th className="sticky top-0 z-10 border-b-2 border-neo-ink bg-neo-yellow px-3 py-1.5 text-right font-display text-xs font-black uppercase tracking-wide">
                    Accuracy
                  </th>
                  <th className="sticky top-0 z-10 border-b-2 border-neo-ink bg-neo-yellow px-3 py-1.5 text-right font-display text-xs font-black uppercase tracking-wide">
                    Words
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasRows ? (
                  rows.map((player) => (
                    <tr
                      key={player.rowId}
                      className={`odd:bg-neo-paper even:bg-neo-paper/75 ${player.isHost ? 'bg-neo-yellow/20' : ''}`}
                    >
                      <td className="px-3 py-1.5 font-body text-sm font-semibold">
                        {player.displayName}
                      </td>
                      <td className="px-3 py-1.5 font-body text-sm">
                        <Badge
                          className="border-2"
                          variant={
                            player.isHost
                              ? 'accent'
                              : player.team === 'A'
                              ? 'teamA'
                              : player.team === 'B'
                                ? 'teamB'
                                : 'neutral'
                          }
                        >
                          {teamLabel(player.team)}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm">
                        {player.accuracy == null ? '—' : `${player.accuracy}%`}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm">
                        {player.correctCount}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center">
                      <span className="ui-subtext font-semibold">No player stats yet.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {role === 'host' ? (
            <div className="grid w-full grid-cols-1 gap-2 pt-1 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Button
                type="button"
                size="default"
                variant="teamB"
                className="w-full"
                onClick={() => {
                  void onResetMatch();
                }}
              >
                Reset Match
              </Button>
              <Button
                type="button"
                size="default"
                variant="neutral"
                className="w-full sm:min-w-[140px]"
                onClick={onClose}
              >
                Close Lobby
              </Button>
            </div>
          ) : (
            <p
              className="pt-1 text-center font-display text-sm font-black uppercase tracking-wide text-neo-muted"
              aria-live="polite"
              aria-atomic="true"
            >
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
