import { useMemo, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';

interface ConfettiBurstProps {
  burstKey: number;
  visible: boolean;
}

interface ConfettiPiece {
  id: number;
  emitter: 'left' | 'right';
  sizePx: number;
  durationMs: number;
  delayMs: number;
  burstXPx: number;
  burstYPx: number;
  rotationDeg: number;
  color: string;
}

const CONFETTI_COLORS = ['#ef5a24', '#1f78c9', '#f4d941', '#0c9f61', '#7f5af0', '#ff7a59'];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildConfettiPieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => {
    const fromLeft = index % 2 === 0;
    return {
      id: index,
      emitter: fromLeft ? 'left' : 'right',
      sizePx: randomBetween(8, 16),
      durationMs: Math.round(randomBetween(2400, 4200)),
      delayMs: Math.round(randomBetween(0, 420)),
      burstXPx: Math.round(fromLeft ? randomBetween(320, 980) : randomBetween(-980, -320)),
      burstYPx: Math.round(randomBetween(-860, -320)),
      rotationDeg: Math.round(randomBetween(420, 980)),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    };
  });
}

export function ConfettiBurst({ burstKey, visible }: ConfettiBurstProps) {
  const prefersReducedMotion = useReducedMotion();
  // A new burst key intentionally reseeds piece trajectories.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pieces = useMemo(() => buildConfettiPieces(250), [burstKey]);

  if (!visible || prefersReducedMotion) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[86] overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={`${burstKey}-${piece.id}`}
          className="confetti-piece absolute"
          style={
            {
              ...(piece.emitter === 'left' ? { left: '-2vw' } : { right: '-2vw' }),
              bottom: '-2vh',
              width: `${piece.sizePx}px`,
              height: `${Math.max(4, piece.sizePx * 0.52)}px`,
              backgroundColor: piece.color,
              animationDuration: `${piece.durationMs}ms`,
              animationDelay: `${piece.delayMs}ms`,
              '--confetti-burst-x': `${piece.burstXPx}px`,
              '--confetti-burst-y': `${piece.burstYPx}px`,
              '--confetti-rotate': `${piece.rotationDeg}deg`,
            } as unknown as CSSProperties
          }
        />
      ))}
    </div>
  );
}
