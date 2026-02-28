import { useEffect, useState } from 'react';
import { Badge } from '@/components/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { useStickyInputFocus } from '@/lib/focus';
import { cn } from '@/lib/utils';
import type { PlayerInputViewModel } from '@/types/ui';

interface PlayerInputPanelProps {
  model: PlayerInputViewModel | null;
  onSubmitWord: (typed: string) => Promise<void>;
}

export function PlayerInputPanel({ model, onSubmitWord }: PlayerInputPanelProps) {
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'submitted' | 'rejected'>('idle');
  const [submitting, setSubmitting] = useState(false);

  const targetWord = model?.currentWord ?? '';
  const canType = Boolean(model?.canSubmit) && Boolean(targetWord) && !submitting;

  const focusRef = useStickyInputFocus(canType, [targetWord, feedback, submitting]);

  useEffect(() => {
    setTyped('');
    setSubmitting(false);
  }, [targetWord]);

  useEffect(() => {
    if (feedback === 'idle') {
      return;
    }

    const handle = window.setTimeout(() => {
      setFeedback('idle');
    }, 420);

    return () => {
      window.clearTimeout(handle);
    };
  }, [feedback]);

  async function handleProgressInput(value: string): Promise<void> {
    if (!canType) {
      return;
    }

    if (!targetWord.startsWith(value)) {
      setTyped('');
      setFeedback('rejected');
      return;
    }

    setTyped(value);

    if (value !== targetWord) {
      return;
    }

    try {
      setSubmitting(true);
      await onSubmitWord(value);
      setTyped('');
      setFeedback('submitted');
    } catch {
      setFeedback('rejected');
    } finally {
      setSubmitting(false);
    }
  }

  const feedbackBadge =
    feedback === 'submitted'
      ? { variant: 'success' as const, text: 'Hit' }
      : feedback === 'rejected'
        ? { variant: 'danger' as const, text: 'Reset' }
        : null;

  return (
    <Card>
      <CardHeader className="mb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Player Input</CardTitle>
        {feedbackBadge ? <Badge variant={feedbackBadge.variant}>{feedbackBadge.text}</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {model ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                model.playerStatus === 'Active'
                  ? 'success'
                  : model.playerStatus === 'Eliminated'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {model.playerName} • {model.playerStatus}
            </Badge>
            {model.deadlineAtMicros ? <Badge variant="danger">Sudden Death Live</Badge> : null}
          </div>
        ) : (
          <Badge variant="neutral">Observer mode</Badge>
        )}

        <div className="rounded-[12px] border-4 border-neo-ink bg-neo-yellow/35 p-3 shadow-neo-sm">
          <p className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-neo-muted">
            Target Word
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(targetWord || '...').split('').map((char, index) => {
              const isFilled = index < typed.length;
              const isActive = index === typed.length;
              return (
                <span
                  key={`${char}-${index}`}
                  className={cn(
                    'inline-flex min-h-9 min-w-8 items-center justify-center rounded-[8px] border-2 border-neo-ink px-2 font-display text-lg font-extrabold uppercase shadow-neo-sm',
                    isFilled ? 'bg-neo-success text-neo-paper' : 'bg-neo-paper text-neo-ink',
                    isActive && canType ? 'bg-neo-yellow' : ''
                  )}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </div>

        <Input
          ref={focusRef}
          value={typed}
          onChange={event => {
            void handleProgressInput(event.target.value);
          }}
          placeholder={canType ? 'Type continuously. Mistake resets progress.' : 'Waiting for next round'}
          disabled={!canType}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
        />

        {!model?.canSubmit && model?.disabledReason ? (
          <p className="font-body text-sm text-neo-muted">{model.disabledReason}</p>
        ) : (
          <p className="font-body text-xs text-neo-muted">
            No Enter required. Complete the word to submit automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
