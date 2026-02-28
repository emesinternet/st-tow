import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/shared/ui/card';
import { cn } from '@/lib/utils';
import type { PlayerInputViewModel } from '@/types/ui';
import { evaluateTypingProgress } from '@/components/player/typingProgress';

interface PlayerInputPanelProps {
  model: PlayerInputViewModel | null;
  onSubmitWord: (typed: string) => Promise<void>;
  preMatch?: boolean;
}

export function PlayerInputPanel({
  model,
  onSubmitWord,
  preMatch = false,
}: PlayerInputPanelProps) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetWord = model?.currentWord ?? '';
  const isEliminated = model?.playerStatus === 'Eliminated';
  const showReadyMessage = preMatch && !isEliminated;
  const readyName = model?.playerName?.trim() || 'PLAYER';
  const displayWord = isEliminated ? 'ELIMINATED' : targetWord || '...';
  const canType = Boolean(model?.canSubmit) && Boolean(targetWord) && !submitting;

  useEffect(() => {
    setTyped('');
    setSubmitting(false);
  }, [targetWord]);

  const handleProgressInput = useCallback(async (value: string): Promise<void> => {
    if (!canType) {
      return;
    }

    const progress = evaluateTypingProgress(targetWord, value);
    setTyped(progress.nextTyped);

    if (progress.feedback === 'rejected') {
      return;
    }

    if (!progress.shouldSubmit) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmitWord(value);
      setTyped('');
    } catch {
      // Keep local typing state stable; submission errors are surfaced by toast in App.
    } finally {
      setSubmitting(false);
    }
  }, [canType, onSubmitWord, targetWord]);

  useEffect(() => {
    if (!canType) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      let nextValue = typed;
      if (event.key === 'Backspace') {
        event.preventDefault();
        nextValue = typed.slice(0, -1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        nextValue = '';
      } else if (event.key.length === 1) {
        event.preventDefault();
        nextValue = typed + event.key.toLowerCase();
      } else {
        return;
      }

      void handleProgressInput(nextValue);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [canType, handleProgressInput, typed]);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="p-4">
          {showReadyMessage ? (
            <p className="text-center font-display text-2xl font-extrabold uppercase tracking-wide text-neo-muted sm:text-3xl">
              Get ready to type {readyName}!
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {displayWord.split('').map((char, index) => {
                const isFilled = index < typed.length;
                const isActive = index === typed.length;
                return (
                  <span
                    key={`${char}-${index}`}
                    className={cn(
                      'inline-flex min-h-14 min-w-11 items-center justify-center rounded-[10px] border-2 border-neo-ink px-2 font-display text-3xl font-extrabold uppercase shadow-neo-sm sm:min-h-16 sm:min-w-12 sm:text-4xl',
                      isEliminated
                        ? 'bg-neo-danger text-neo-paper'
                        : isFilled
                          ? 'bg-neo-success text-neo-paper'
                          : 'bg-neo-paper text-neo-ink',
                      !isEliminated && isActive && canType ? 'bg-neo-yellow' : ''
                    )}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
