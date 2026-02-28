import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';

interface LandingPanelProps {
  displayName: string;
  joinCode: string;
  onDisplayNameChange: (next: string) => void;
  onJoinCodeChange: (next: string) => void;
  onJoin: () => Promise<void>;
  onCreateLobby: () => Promise<void>;
}

export function LandingPanel({
  displayName,
  joinCode,
  onDisplayNameChange,
  onJoinCodeChange,
  onJoin,
  onCreateLobby,
}: LandingPanelProps) {
  return (
    <Card className="mx-auto max-w-2xl">
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
          <span className="font-display text-xs font-bold uppercase tracking-wide">Join Code</span>
          <Input
            value={joinCode}
            maxLength={6}
            onChange={event => onJoinCodeChange(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="default" onClick={() => void onJoin()}>
            Join Lobby
          </Button>
          <Button type="button" variant="teamB" onClick={() => void onCreateLobby()}>
            Host New Lobby
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
