import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/shared/ui/card';
import { formatSeconds } from '@/lib/format';
import type { MatchHudViewModel } from '@/types/ui';

interface MatchHudProps {
  hud: MatchHudViewModel;
}

export function MatchHud({ hud }: MatchHudProps) {
  const hostScore = hud.hostScore ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-center gap-2 text-center font-display font-black tracking-wide sm:gap-3">
          <p className="text-3xl tabular-nums text-neo-teamA sm:text-4xl">
            A {hud.teamAPulls}
          </p>
          <span className="pb-1 text-xl text-neo-muted sm:text-2xl">|</span>
          <p className="text-4xl tabular-nums text-neo-ink sm:text-5xl">
            {formatSeconds(hud.secondsRemaining)}
          </p>
          <span className="pb-1 text-xl text-neo-muted sm:text-2xl">|</span>
          <p className="text-3xl tabular-nums text-neo-teamB sm:text-4xl">
            B {hud.teamBPulls}
          </p>
          <span className="pb-1 text-xl text-neo-muted sm:text-2xl">|</span>
          <p className="text-3xl tabular-nums text-neo-ink sm:text-4xl">
            H {hostScore}
          </p>
        </div>
        <div className="relative h-20 rounded-full border-4 border-neo-ink bg-gradient-to-r from-neo-teamA/25 via-neo-yellow/25 to-neo-teamB/25 sm:h-24">
          <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-neo-ink/35" />
          <motion.div
            className="absolute top-1/2 h-10 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neo-ink bg-neo-ink sm:h-12 sm:w-6"
            animate={{ left: `${hud.normalizedRopePosition}%` }}
            transition={{ type: 'spring', stiffness: 150, damping: 24 }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
