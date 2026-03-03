import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';

interface LandingPanelProps {
  displayName: string;
  joinCode: string;
  roundMinutes: number;
  lockLobby: boolean;
  tieZoneSize: 'small' | 'medium' | 'large' | 'xlarge';
  onDisplayNameChange: (next: string) => void;
  onJoinCodeChange: (next: string) => void;
  onRoundMinutesChange: (next: number) => void;
  onLockLobbyChange: (next: boolean) => void;
  onTieZoneSizeChange: (next: 'small' | 'medium' | 'large' | 'xlarge') => void;
  onJoin: () => Promise<void>;
  onCreateLobby: () => Promise<void>;
}

export function LandingPanel({
  displayName,
  joinCode,
  roundMinutes,
  lockLobby,
  tieZoneSize,
  onDisplayNameChange,
  onJoinCodeChange,
  onRoundMinutesChange,
  onLockLobbyChange,
  onTieZoneSizeChange,
  onJoin,
  onCreateLobby,
}: LandingPanelProps) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="flex h-full min-h-[280px] flex-col gap-7">
          <div className="space-y-2">
            <CardTitle className="text-neo-ink">Join a Lobby</CardTitle>
            <p className="ui-subtext">Enter a lobby code and jump in.</p>
            <label className="block space-y-1">
              <span className="font-display text-xs font-bold uppercase tracking-wide">
                Player Name
              </span>
              <Input
                value={displayName}
                maxLength={24}
                onChange={(event) => onDisplayNameChange(event.target.value)}
                placeholder="Player"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block space-y-1">
                <span className="font-display text-xs font-bold uppercase tracking-wide">
                  Join Code
                </span>
                <Input
                  value={joinCode}
                  maxLength={6}
                  onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                />
              </label>
              <Button
                type="button"
                variant="default"
                className="w-full sm:w-auto"
                onClick={() => void onJoin()}
              >
                Join Lobby
              </Button>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <CardTitle className="text-neo-ink">How to Play</CardTitle>
            <p className="ui-subtext">
              Type your words fast to pull the dragon to your side.
            </p>
            <p className="ui-subtext">
              Every correct word adds team momentum. In sudden death, mistakes can eliminate players.
            </p>
            <p className="ui-subtext">Lobbies support up to 50 total players.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-[280px] flex-col">
        <CardHeader>
          <CardTitle>Host a Lobby</CardTitle>
          <p className="ui-subtext">Configure your lobby and start a new game.</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="font-display text-xs font-bold uppercase tracking-wide">
                Match Minutes
              </span>
              <Input
                type="number"
                min={1}
                max={10}
                step={1}
                value={roundMinutes}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (!Number.isFinite(parsed)) {
                    return;
                  }
                  onRoundMinutesChange(Math.max(1, Math.min(10, Math.trunc(parsed))));
                }}
                placeholder="3"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-display text-xs font-bold uppercase tracking-wide">
                Lock Lobby
              </span>
              <span className="flex items-center gap-2 rounded-[12px] border-4 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
                <input
                  type="checkbox"
                  checked={lockLobby}
                  onChange={(event) => onLockLobbyChange(event.target.checked)}
                  className="neo-focus h-4 w-4 cursor-pointer accent-neo-teamB"
                />
                <span className="ui-subtext">Block new players from joining after match start</span>
              </span>
            </label>

            <label className="block space-y-1">
              <span className="font-display text-xs font-bold uppercase tracking-wide">
                Tie Zone Width
              </span>
              <select
                value={tieZoneSize}
                onChange={(event) =>
                  onTieZoneSizeChange(
                    event.target.value as 'small' | 'medium' | 'large' | 'xlarge'
                  )
                }
                className="neo-focus h-11 w-full rounded-[12px] border-4 border-neo-ink bg-neo-paper px-3 font-display text-sm font-bold uppercase tracking-wide text-neo-ink shadow-neo-sm"
              >
                <option value="small">Small (10%)</option>
                <option value="medium">Medium (20%)</option>
                <option value="large">Large (30%)</option>
                <option value="xlarge">XLarge (40%)</option>
              </select>
            </label>
          </div>

          <div className="mt-auto grid w-full grid-cols-1 gap-2 pt-2">
            <Button
              type="button"
              variant="teamB"
              className="w-full"
              onClick={() => void onCreateLobby()}
            >
              Host New Lobby
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
