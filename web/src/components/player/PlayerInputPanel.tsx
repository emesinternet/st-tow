import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/shared/ui/card';
import { cn } from '@/lib/utils';
import type { PlayerInputViewModel } from '@/types/ui';
import { evaluateTypingProgress } from '@/components/player/typingProgress';

interface PlayerInputPanelProps {
  model: PlayerInputViewModel | null;
  onSubmitWord: (typed: string) => Promise<void>;
  onRecordMistake: () => Promise<void>;
  preMatch?: boolean;
  activePowerId?: string;
}

const FLIPPER_POWER_ID = 'flipper_burst';
const MIN_FLIPPED_LETTERS = 2;
const MAX_FLIPPED_LETTERS = 4;

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextPseudoRandom(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function deriveFlippedLetterIndices(word: string, seedKey: string): Set<number> {
  const letters = [...word];
  const length = letters.length;
  if (length <= 0) {
    return new Set<number>();
  }

  const maxCount = Math.min(MAX_FLIPPED_LETTERS, length);
  const minCount = Math.min(MIN_FLIPPED_LETTERS, maxCount);
  const range = Math.max(1, maxCount - minCount + 1);
  let seed = hashText(`${seedKey}:${word}`);
  const count = minCount + (seed % range);

  const indices = new Set<number>();
  while (indices.size < count) {
    seed = nextPseudoRandom(seed);
    indices.add(seed % length);
  }
  return indices;
}

function isTypingBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }
  return target.closest('button, a, select, [role="button"], [role="textbox"]') != null;
}

export function PlayerInputPanel({
  model,
  onSubmitWord,
  onRecordMistake,
  preMatch = false,
  activePowerId = '',
}: PlayerInputPanelProps) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rowScale, setRowScale] = useState(1);
  const [scaledRowHeight, setScaledRowHeight] = useState(64);
  const scaleTrackRef = useRef<HTMLDivElement | null>(null);
  const scaleRowRef = useRef<HTMLDivElement | null>(null);

  const targetWord = model?.currentWord ?? '';
  const isEliminated = model?.playerStatus === 'Eliminated';
  const showReadyMessage = preMatch && !isEliminated;
  const readyName = model?.playerName?.trim() || 'PLAYER';
  const displayWord = isEliminated ? 'ELIMINATED' : targetWord || '...';
  const canType = Boolean(model?.canSubmit) && Boolean(targetWord) && !submitting;
  const isFlipperActive = activePowerId === FLIPPER_POWER_ID && !isEliminated && !showReadyMessage;
  const flippedLetterIndices = useMemo(() => {
    if (!isFlipperActive || !targetWord) {
      return new Set<number>();
    }
    return deriveFlippedLetterIndices(
      targetWord,
      `${model?.playerId ?? 'unknown'}:${activePowerId}`
    );
  }, [activePowerId, isFlipperActive, model?.playerId, targetWord]);

  const recomputeScale = useCallback(() => {
    const track = scaleTrackRef.current;
    const row = scaleRowRef.current;
    if (!track || !row) {
      return;
    }

    const availableWidth = Math.max(0, track.clientWidth - 2);
    const contentWidth = row.scrollWidth;
    const contentHeight = row.scrollHeight;
    if (availableWidth <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      setRowScale(1);
      if (contentHeight > 0) {
        setScaledRowHeight(contentHeight);
      }
      return;
    }

    const nextScale = Math.max(0.01, Math.min(1, availableWidth / contentWidth));
    setRowScale((current) => (Math.abs(current - nextScale) < 0.002 ? current : nextScale));
    const nextHeight = Math.max(1, Math.ceil(contentHeight * nextScale));
    setScaledRowHeight((current) => (Math.abs(current - nextHeight) < 1 ? current : nextHeight));
  }, []);

  useEffect(() => {
    setTyped('');
    setSubmitting(false);
  }, [targetWord]);

  const handleProgressInput = useCallback(
    async (value: string): Promise<void> => {
      if (!canType) {
        return;
      }

      const progress = evaluateTypingProgress(targetWord, value);
      setTyped(progress.nextTyped);

      if (progress.feedback === 'rejected') {
        void onRecordMistake().catch(() => {
          // Mistake telemetry is best-effort and should never block local typing flow.
        });
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
    },
    [canType, onRecordMistake, onSubmitWord, targetWord]
  );

  useEffect(() => {
    if (!canType) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (isTypingBlockedTarget(event.target)) {
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

  useLayoutEffect(() => {
    recomputeScale();
  }, [displayWord, recomputeScale]);

  useEffect(() => {
    const track = scaleTrackRef.current;
    const row = scaleRowRef.current;
    if (!track || !row) {
      return;
    }

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', recomputeScale);
      return () => {
        window.removeEventListener('resize', recomputeScale);
      };
    }

    const observer = new ResizeObserver(() => {
      recomputeScale();
    });
    observer.observe(track);
    observer.observe(row);

    return () => {
      observer.disconnect();
    };
  }, [recomputeScale]);

  useEffect(() => {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (!fonts?.ready) {
      return;
    }
    let cancelled = false;
    void fonts.ready.then(() => {
      if (!cancelled) {
        recomputeScale();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [displayWord, recomputeScale]);

  return (
    <Card>
      <CardContent className="space-y-3">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {showReadyMessage
            ? `Get ready to type ${readyName}`
            : isEliminated
              ? 'Eliminated'
              : `Current word ${displayWord}. Progress ${typed.length} of ${displayWord.length}`}
        </p>
        <div className="pb-3">
          {showReadyMessage ? (
            <p
              role="status"
              className="text-center font-display text-2xl font-extrabold uppercase tracking-wide text-neo-muted sm:text-3xl"
            >
              Get ready to type {readyName}!
            </p>
          ) : (
            <div ref={scaleTrackRef} className="w-full overflow-x-hidden overflow-y-visible pb-1">
              <div className="flex w-full justify-center overflow-visible">
                <div
                  className="w-max overflow-visible"
                  style={{
                    transform: rowScale < 0.999 ? `scale(${rowScale})` : 'none',
                    transformOrigin: 'top center',
                    height: `${scaledRowHeight}px`,
                  }}
                >
                  <div
                    ref={scaleRowRef}
                    className="flex w-max flex-nowrap justify-center gap-2 overflow-visible"
                    role="list"
                    aria-label="Word letters"
                  >
                    {displayWord.split('').map((char, index) => {
                      const isFilled = index < typed.length;
                      const isActive = index === typed.length;
                      const shouldFlipLetter = isFlipperActive && flippedLetterIndices.has(index);
                      return (
                        <span
                          key={`${char}-${index}`}
                          role="listitem"
                          className={cn(
                            'inline-flex h-14 w-11 shrink-0 items-center justify-center rounded-[10px] border-4 border-neo-ink px-2 font-display text-3xl font-extrabold uppercase leading-none shadow-neo-sm sm:h-16 sm:w-12 sm:text-4xl',
                            isEliminated
                              ? 'bg-neo-danger text-neo-paper'
                              : isFilled
                                ? 'bg-neo-success text-neo-paper'
                                : 'bg-neo-paper text-neo-ink',
                            !isEliminated && isActive && canType ? 'bg-neo-yellow' : ''
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block',
                              shouldFlipLetter ? '[transform:scaleX(-1)]' : ''
                            )}
                          >
                            {char}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
