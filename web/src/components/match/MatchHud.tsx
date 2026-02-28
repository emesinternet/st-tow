import { motion } from 'framer-motion';
import { Badge } from '@/components/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { formatPhase, formatSeconds } from '@/lib/format';
import type { MatchHudViewModel } from '@/types/ui';

interface MatchHudProps {
  hud: MatchHudViewModel;
}

function teamTone(forceA: number, forceB: number): 'teamA' | 'teamB' | 'neutral' {
  if (forceA > forceB) {
    return 'teamA';
  }
  if (forceB > forceA) {
    return 'teamB';
  }
  return 'neutral';
}

export function MatchHud({ hud }: MatchHudProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="mb-2 flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-xl">Match HUD</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="accent">{formatPhase(hud.phase)}</Badge>
          <Badge variant={hud.mode === 'Elimination' ? 'danger' : 'neutral'}>{hud.mode}</Badge>
          <Badge variant="neutral">Timer {formatSeconds(hud.secondsRemaining)}</Badge>
          {hud.winnerTeam ? <Badge variant="success">Winner Team {hud.winnerTeam}</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-[12px] border-4 border-neo-ink bg-white p-3 shadow-neo-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide">
            <span className="text-neo-teamA">Team A Push {hud.teamAForce}</span>
            <span className="text-neo-teamB">Team B Push {hud.teamBForce}</span>
          </div>
          <div className="relative h-11 rounded-full border-4 border-neo-ink bg-gradient-to-r from-neo-teamA/25 via-neo-yellow/25 to-neo-teamB/25">
            <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-neo-ink/35" />
            <motion.div
              className="absolute top-1/2 h-7 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neo-ink bg-neo-ink"
              animate={{ left: `${hud.normalizedRopePosition}%` }}
              transition={{ type: 'spring', stiffness: 150, damping: 24 }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Badge variant={teamTone(hud.teamAForce, hud.teamBForce)}>Rope {hud.ropePosition}</Badge>
            <Badge variant="neutral">Alive A/B {hud.aliveTeamA}/{hud.aliveTeamB}</Badge>
          </div>
        </div>

        <div className="rounded-[12px] border-4 border-neo-ink bg-neo-yellow/40 p-4 shadow-neo-sm">
          <p className="mb-1 font-display text-xs font-bold uppercase tracking-wide text-neo-muted">Typing Model</p>
          <p className="font-display text-2xl font-black leading-tight text-neo-ink sm:text-3xl">
            Per-player random words
          </p>
          <p className="mt-2 font-body text-xs text-neo-muted">
            Each active player sees and advances their own target word stream.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
