import { type FormEvent, useEffect, useState } from 'react';
import { Badge } from '@/components/shared/ui/badge';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Input } from '@/components/shared/ui/input';
import { useStickyInputFocus } from '@/lib/focus';
import type { PlayerInputViewModel } from '@/types/ui';

interface PlayerInputPanelProps {
  model: PlayerInputViewModel | null;
  currentWord: string;
  wordVersion: number;
  onSubmitWord: (typed: string) => Promise<void>;
}

export function PlayerInputPanel({
  model,
  currentWord,
  wordVersion,
  onSubmitWord,
}: PlayerInputPanelProps) {
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'submitted' | 'rejected'>('idle');

  const focusRef = useStickyInputFocus(Boolean(model?.canSubmit), [wordVersion, feedback, currentWord]);

  useEffect(() => {
    setTyped('');
  }, [wordVersion]);

  useEffect(() => {
    if (feedback === 'idle') {
      return;
    }

    const handle = window.setTimeout(() => {
      setFeedback('idle');
    }, 900);

    return () => {
      window.clearTimeout(handle);
    };
  }, [feedback]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const value = typed.trim();
    if (!value || !model?.canSubmit) {
      return;
    }

    try {
      await onSubmitWord(value);
      setTyped('');
      setFeedback('submitted');
    } catch {
      setFeedback('rejected');
    }
  }

  const feedbackBadge =
    feedback === 'submitted'
      ? { variant: 'success' as const, text: 'Submitted' }
      : feedback === 'rejected'
        ? { variant: 'danger' as const, text: 'Rejected' }
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

        <form className="space-y-2" onSubmit={event => void handleSubmit(event)}>
          <Input
            ref={focusRef}
            value={typed}
            onChange={event => setTyped(event.target.value)}
            placeholder={model?.canSubmit ? 'Type the word exactly' : 'Waiting for next round'}
            disabled={!model?.canSubmit}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="default" disabled={!model?.canSubmit}>
              Submit (Enter)
            </Button>
            <Badge variant="accent">target={currentWord || '...'}</Badge>
          </div>
        </form>

        {!model?.canSubmit && model?.disabledReason ? (
          <p className="font-body text-sm text-neo-muted">{model.disabledReason}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
