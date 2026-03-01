import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useMemo, useState } from 'react';
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
const REVEAL_BOUNCE_SEQUENCE = [0, -56, 0, -56, 0, -56, 0];
const REVEAL_BOUNCE_DURATION_MS = 1850;

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

export function RpsTieBreakModal({ model, role, onVote, onContinue }: RpsTieBreakModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const prefersReducedMotion = useReducedMotion();
  const isReveal = model?.stage === 'Reveal';
  const isTieReveal = isReveal && model?.winnerTeam !== 'A' && model?.winnerTeam !== 'B';
  const [revealResolved, setRevealResolved] = useState(false);
  const [revealAnimationVersion, setRevealAnimationVersion] = useState(0);
  const revealSignature = useMemo(() => {
    if (!model || model.stage !== 'Reveal') {
      return '';
    }
    return `${model.matchId}:${model.roundNumber}:${model.teamAChoice}:${model.teamBChoice}:${model.winnerTeam}`;
  }, [model]);

  useEffect(() => {
    if (!isReveal || !revealSignature) {
      setRevealResolved(false);
      return;
    }
    setRevealResolved(false);
    setRevealAnimationVersion((current) => current + 1);
  }, [isReveal, revealSignature]);

  if (!model) {
    return null;
  }
  const displayTeamAChoice = isReveal && !revealResolved ? 'rock' : model.teamAChoice || 'rock';
  const displayTeamBChoice = isReveal && !revealResolved ? 'rock' : model.teamBChoice || 'rock';
  const voteButtonVariant =
    model.myTeam === 'A' ? 'teamA' : model.myTeam === 'B' ? 'teamB' : 'neutral';
  const mirrorVoteHands = model.myTeam === 'B';

  return (
    <div className="fixed inset-0 z-[88] flex items-center justify-center bg-neo-ink/45 p-3">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`w-full max-w-3xl ${isReveal ? 'bg-rps-reveal-gradient !p-0' : ''}`}
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
              {revealResolved ? (
                isTieReveal ? (
                  <motion.p
                    id={titleId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: prefersReducedMotion ? 0.12 : 0.18,
                      ease: 'easeOut',
                    }}
                    className="font-display text-4xl font-black uppercase tracking-wide text-neo-ink sm:text-6xl"
                  >
                    TIE!
                  </motion.p>
                ) : (
                  <>
                    <motion.p
                      id={descriptionId}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0.12 : 0.2,
                        ease: 'easeOut',
                      }}
                      className="font-display text-2xl font-black uppercase tracking-wide text-neo-ink sm:text-4xl"
                    >
                      {beatsLabel(model)}
                    </motion.p>
                    <motion.p
                      id={titleId}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        duration: prefersReducedMotion ? 0.12 : 0.22,
                        delay: prefersReducedMotion ? 0 : 0.04,
                        ease: 'easeOut',
                      }}
                      className="font-display text-4xl font-black uppercase tracking-wide text-neo-ink sm:text-6xl"
                    >
                      {winnerLabel(model.winnerTeam)}!
                    </motion.p>
                  </>
                )
              ) : (
                <>
                  <p id={descriptionId} className="sr-only">
                    Reveal animation in progress
                  </p>
                  <p className="invisible font-display text-2xl font-black uppercase tracking-wide sm:text-4xl">
                    rock beats scissors
                  </p>
                  <p className="invisible font-display text-4xl font-black uppercase tracking-wide sm:text-6xl">
                    red team wins!
                  </p>
                </>
              )}
            </div>
          ) : (
            <p
              id={titleId}
              className="text-center font-display text-3xl font-black uppercase tracking-wide text-neo-ink sm:text-4xl"
            >
              {role === 'host' ? 'PLAYERS ARE VOTING!' : 'VOTE!'}
            </p>
          )}

          {model.stage === 'Voting' ? (
            role === 'host' ? (
              <>
                <p className="mt-0 text-center font-display text-5xl font-black tabular-nums text-neo-ink sm:text-6xl">
                  {model.secondsRemaining}
                </p>
                <p id={descriptionId} className="sr-only" aria-live="polite" aria-atomic="true">
                  Players are voting. {model.secondsRemaining} seconds remaining.
                </p>
              </>
            ) : (
              <>
                <p className="mt-0 text-center font-display text-5xl font-black tabular-nums text-neo-ink sm:text-6xl">
                  {model.secondsRemaining}
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {CHOICES.map((choice) => {
                    const voteCount = model.myTeamCounts ? model.myTeamCounts[choice.id] : null;
                    return (
                      <Button
                        key={choice.id}
                        type="button"
                        variant={voteButtonVariant}
                        disabled={!model.canVote}
                        onClick={() => void onVote(choice.id)}
                        className={`h-44 flex-col gap-1 py-2 disabled:opacity-100 sm:h-52 ${
                          model.myVote === choice.id ? 'ring-4 ring-neo-yellow' : ''
                        }`}
                      >
                        <img
                          src={placeholderForChoice(choice.id)}
                          alt={choice.label}
                          className={`h-auto w-[8.25rem] max-w-full object-contain sm:w-[9.9rem] ${mirrorVoteHands ? 'scale-x-[-1]' : ''}`}
                        />
                        <span className="text-base sm:text-lg">{choice.label}</span>
                        <span className="min-h-[14px] text-[11px] font-mono font-semibold normal-case tracking-normal">
                          {voteCount == null ? '' : `${voteCount} votes`}
                        </span>
                      </Button>
                    );
                  })}
                </div>
                <p id={descriptionId} className="sr-only" aria-live="polite" aria-atomic="true">
                  Vote now. {model.secondsRemaining} seconds remaining.
                </p>
                {!(role === 'player' && model.myTeamCounts) ? (
                  <p className="text-center font-display text-sm font-black uppercase tracking-wide text-neo-muted">
                    Voting in progress...
                  </p>
                ) : null}
              </>
            )
          ) : (
            <>
              <div className="grid flex-1 items-center gap-2 sm:grid-cols-2">
                <div className="px-2 py-2 text-center">
                  <motion.div
                    key={`rps-a-${revealAnimationVersion}`}
                    animate={
                      revealResolved
                        ? { y: 0, rotate: 0 }
                        : prefersReducedMotion
                          ? { y: 0, rotate: 0 }
                          : {
                              y: REVEAL_BOUNCE_SEQUENCE,
                              rotate: [0, -9, 0, -9, 0, -9, 0],
                            }
                    }
                    transition={{
                      duration: prefersReducedMotion ? 0.15 : REVEAL_BOUNCE_DURATION_MS / 1000,
                      ease: 'easeInOut',
                    }}
                    onAnimationComplete={() => {
                      if (!revealResolved) {
                        setRevealResolved(true);
                      }
                    }}
                  >
                    <img
                      src={placeholderForChoice(displayTeamAChoice)}
                      alt={`Red Team ${displayTeamAChoice || 'choice'}`}
                      className="mx-auto block h-auto w-[20.4rem] max-w-full sm:w-[26.2rem]"
                    />
                  </motion.div>
                </div>
                <div className="px-2 py-2 text-center">
                  <motion.div
                    key={`rps-b-${revealAnimationVersion}`}
                    animate={
                      revealResolved
                        ? { y: 0, rotate: 0 }
                        : prefersReducedMotion
                          ? { y: 0, rotate: 0 }
                          : {
                              y: REVEAL_BOUNCE_SEQUENCE,
                              rotate: [0, 9, 0, 9, 0, 9, 0],
                            }
                    }
                    transition={{
                      duration: prefersReducedMotion ? 0.15 : REVEAL_BOUNCE_DURATION_MS / 1000,
                      ease: 'easeInOut',
                    }}
                  >
                    <img
                      src={placeholderForChoice(displayTeamBChoice)}
                      alt={`Blue Team ${displayTeamBChoice || 'choice'}`}
                      className="mx-auto block h-auto w-[20.4rem] max-w-full scale-x-[-1] sm:w-[26.2rem]"
                    />
                  </motion.div>
                </div>
              </div>
              <div className="mt-1">
                {revealResolved ? (
                  isTieReveal ? (
                    <p className="invisible text-center font-display text-sm font-black uppercase tracking-wide">
                      Waiting for host
                    </p>
                  ) : model.canHostContinue ? (
                    <div className="flex justify-center">
                      <Button type="button" variant="teamB" onClick={() => void onContinue()}>
                        Continue
                      </Button>
                    </div>
                  ) : (
                    <p className="text-center font-display text-sm font-black uppercase tracking-wide text-neo-muted">
                      Waiting for host
                    </p>
                  )
                ) : (
                  <p className="invisible text-center font-display text-sm font-black uppercase tracking-wide">
                    Waiting for host
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
