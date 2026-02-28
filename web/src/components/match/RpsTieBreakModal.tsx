import { Button } from '@/components/shared/ui/button';
import { Card, CardContent } from '@/components/shared/ui/card';
import paperImage from '@/assets/paper.png';
import rockImage from '@/assets/rock.png';
import scissorsImage from '@/assets/scissors.png';
import type { RpsTieBreakViewModel, UiRole } from '@/types/ui';

type RpsChoice = 'rock' | 'paper' | 'scissors';

interface RpsTieBreakModalProps {
  model: RpsTieBreakViewModel | null;
  role: UiRole;
  onVote: (choice: RpsChoice) => Promise<void>;
  onContinue: () => Promise<void>;
}

const CHOICES: Array<{ id: RpsChoice; label: string }> = [
  { id: 'rock', label: 'Rock' },
  { id: 'paper', label: 'Paper' },
  { id: 'scissors', label: 'Scissors' },
];

function placeholderForChoice(choice: string): string {
  if (choice === 'rock') {
    return rockImage;
  }
  if (choice === 'paper') {
    return paperImage;
  }
  if (choice === 'scissors') {
    return scissorsImage;
  }
  return rockImage;
}

function winnerLabel(winnerTeam: string): string {
  if (winnerTeam === 'A') {
    return 'Red Team Wins';
  }
  if (winnerTeam === 'B') {
    return 'Blue Team Wins';
  }
  return 'No Winner';
}

function toHandLabel(choice: 'rock' | 'paper' | 'scissors' | ''): string {
  if (!choice) {
    return 'No Vote';
  }
  return choice.toUpperCase();
}

function beatsLabel(model: RpsTieBreakViewModel): string {
  if (model.winnerTeam === 'A') {
    return `${toHandLabel(model.teamAChoice)} BEATS ${toHandLabel(model.teamBChoice)}`;
  }
  if (model.winnerTeam === 'B') {
    return `${toHandLabel(model.teamBChoice)} BEATS ${toHandLabel(model.teamAChoice)}`;
  }
  return `${toHandLabel(model.teamAChoice)} VS ${toHandLabel(model.teamBChoice)}`;
}

export function RpsTieBreakModal({
  model,
  role,
  onVote,
  onContinue,
}: RpsTieBreakModalProps) {
  if (!model) {
    return null;
  }
  const isReveal = model.stage === 'Reveal';

  return (
    <div className="fixed inset-0 z-[88] flex items-center justify-center bg-neo-ink/45 p-3">
      <Card
        className={`w-full max-w-3xl ${
          isReveal
            ? '!bg-gradient-to-r !from-red-200/80 !via-rose-100/55 !to-blue-200/80 !p-0'
            : ''
        }`}
      >
        <CardContent
          className={`${
            isReveal
              ? 'flex min-h-[520px] flex-col gap-3 px-4 py-5 sm:gap-4 sm:px-8 sm:py-6'
              : 'space-y-4'
          }`}
        >
          {isReveal ? (
            <div className="mt-1 space-y-0.5 text-center sm:mt-2 sm:space-y-1">
              <p className="font-display text-2xl font-black uppercase tracking-wide text-neo-ink sm:text-4xl">
                {beatsLabel(model)}
              </p>
              <p className="font-display text-4xl font-black uppercase tracking-wide text-neo-ink sm:text-6xl">
                {winnerLabel(model.winnerTeam)}!
              </p>
            </div>
          ) : (
            <p className="text-center font-display text-3xl font-black uppercase tracking-wide text-neo-ink sm:text-4xl">
              Tie-Break RPS
            </p>
          )}

          {model.stage === 'Voting' ? (
            <>
              <p className="text-center font-display text-5xl font-black tabular-nums text-neo-ink sm:text-6xl">
                {model.secondsRemaining}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {CHOICES.map(choice => (
                  <Button
                    key={choice.id}
                    type="button"
                    variant="teamB"
                    disabled={!model.canVote}
                    onClick={() => void onVote(choice.id)}
                    className={model.myVote === choice.id ? 'ring-4 ring-neo-yellow' : ''}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
              {role === 'player' && model.myTeamCounts ? (
                <div className="rounded-[12px] border-2 border-neo-ink bg-neo-paper px-3 py-2 shadow-neo-sm">
                  <p className="font-display text-xs font-black uppercase tracking-wide text-neo-muted">
                    Your Team Votes
                  </p>
                  <p className="font-mono text-sm font-bold text-neo-ink">
                    Rock {model.myTeamCounts.rock} | Paper {model.myTeamCounts.paper} | Scissors {model.myTeamCounts.scissors}
                  </p>
                </div>
              ) : (
                <p className="text-center font-display text-sm font-black uppercase tracking-wide text-neo-muted">
                  Voting in progress...
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid flex-1 items-center gap-2 sm:grid-cols-2">
                <div className="px-2 py-2 text-center">
                  <img
                    src={placeholderForChoice(model.teamAChoice)}
                    alt={`Red Team ${model.teamAChoice || 'choice'}`}
                    className="mx-auto block h-auto w-[18.5rem] max-w-full sm:w-[23.8rem]"
                  />
                </div>
                <div className="px-2 py-2 text-center">
                  <img
                    src={placeholderForChoice(model.teamBChoice)}
                    alt={`Blue Team ${model.teamBChoice || 'choice'}`}
                    className="mx-auto block h-auto w-[18.5rem] max-w-full scale-x-[-1] sm:w-[23.8rem]"
                  />
                </div>
              </div>
              {model.canHostContinue ? (
                <div className="mt-1 flex justify-center">
                  <Button type="button" variant="teamB" onClick={() => void onContinue()}>
                    Continue
                  </Button>
                </div>
              ) : (
                <p className="mt-1 text-center font-display text-sm font-black uppercase tracking-wide text-neo-muted">
                  Waiting for host
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
