import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/card';
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
    <Card className="mx-auto w-full max-w-[1200px]">
      <CardHeader>
        <CardTitle>Join or Host a Match</CardTitle>
        <CardDescription>
          Enter a join code to play, or host a fresh lobby in one click.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block space-y-1">
          <span className="font-display text-xs font-bold uppercase tracking-wide">Display Name</span>
          <Input
            value={displayName}
            maxLength={24}
            onChange={event => onDisplayNameChange(event.target.value)}
            placeholder="Player"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-display text-xs font-bold uppercase tracking-wide">
            Match Minutes
          </span>
          <Input
            type="number"
            min={1}
            max={60}
            step={1}
            value={roundMinutes}
            onChange={event => {
              const parsed = Number(event.target.value);
              if (!Number.isFinite(parsed)) {
                return;
              }
              onRoundMinutesChange(Math.max(1, Math.min(60, Math.trunc(parsed))));
            }}
            placeholder="1"
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
              onChange={event => onLockLobbyChange(event.target.checked)}
              className="neo-focus h-4 w-4 cursor-pointer accent-neo-teamB"
            />
            <span className="font-body text-sm text-neo-ink">
              Block new players from joining after match start
            </span>
          </span>
        </label>

        <label className="block space-y-1">
          <span className="font-display text-xs font-bold uppercase tracking-wide">
            Tie Zone Width
          </span>
          <select
            value={tieZoneSize}
            onChange={event =>
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

        <label className="block space-y-1">
          <span className="font-display text-xs font-bold uppercase tracking-wide">Join Code</span>
          <Input
            value={joinCode}
            maxLength={6}
            onChange={event => onJoinCodeChange(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
        </label>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={() => void onJoin()}
          >
            Join Lobby
          </Button>
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
  );
}
