import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/shared/ui/card';
import { formatSeconds } from '@/lib/format';
import type { MatchHudViewModel } from '@/types/ui';

interface MatchHudProps {
  hud: MatchHudViewModel;
}

export function MatchHud({ hud }: MatchHudProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-3 items-center gap-3">
          <p className="text-right font-display text-4xl font-black tabular-nums tracking-wide text-neo-teamA sm:text-5xl">
            {hud.teamAForce}
          </p>
          <p className="text-center font-display text-4xl font-black tabular-nums tracking-wide sm:text-5xl">
            {formatSeconds(hud.secondsRemaining)}
          </p>
          <p className="text-left font-display text-4xl font-black tabular-nums tracking-wide text-neo-teamB sm:text-5xl">
            {hud.teamBForce}
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
