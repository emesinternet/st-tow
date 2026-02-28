import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/shared/ui/card';
import { formatSeconds } from '@/lib/format';
import type { MatchHudViewModel, TeamPlayerViewModel } from '@/types/ui';

interface MatchHudProps {
  hud: MatchHudViewModel;
  teamAPlayers: TeamPlayerViewModel[];
  teamBPlayers: TeamPlayerViewModel[];
}

const SPIKE_WALL_CLIP_PATH =
  'polygon(0% 0%, 75% 0%, 100% 10%, 75% 20%, 100% 30%, 75% 40%, 100% 50%, 75% 60%, 100% 70%, 75% 80%, 100% 90%, 75% 100%, 0% 100%, 25% 90%, 0% 80%, 25% 70%, 0% 60%, 25% 50%, 0% 40%, 25% 30%, 0% 20%, 25% 10%)';

function TeamMarkers({
  players,
  tone,
}: {
  players: TeamPlayerViewModel[];
  tone: 'teamA' | 'teamB';
}) {
  const connected = players.filter(player => player.status !== 'Left');
  const ballClassName = tone === 'teamA' ? 'bg-neo-teamA' : 'bg-neo-teamB';
  const prevCountsRef = useRef(new Map<string, number>());
  const [bounceTokens, setBounceTokens] = useState<Record<string, number>>({});

  useEffect(() => {
    setBounceTokens(current => {
      let changed = false;
      let next = current;
      const seen = new Set<string>();

      for (const player of connected) {
        seen.add(player.playerId);
        const previous = prevCountsRef.current.get(player.playerId);
        if (previous != null && player.correctCount > previous) {
          if (!changed) {
            next = { ...current };
            changed = true;
          }
          next[player.playerId] = (next[player.playerId] ?? 0) + 1;
        }
        prevCountsRef.current.set(player.playerId, player.correctCount);
      }

      for (const playerId of Array.from(prevCountsRef.current.keys())) {
        if (!seen.has(playerId)) {
          prevCountsRef.current.delete(playerId);
          if (!changed && current[playerId] != null) {
            next = { ...current };
            changed = true;
          }
          if (changed) {
            delete next[playerId];
          }
        }
      }

      return changed ? next : current;
    });
  }, [connected]);

  return (
    <div className="flex h-full items-end overflow-auto px-1">
      <div className="grid min-h-full w-full grid-cols-[repeat(auto-fill,minmax(48px,1fr))] content-end items-end gap-x-1 gap-y-1">
        {connected.map(player => (
          <div key={player.playerId} className="flex h-7 flex-col items-center justify-end text-center">
            <span className="max-w-[52px] truncate text-[8px] font-bold uppercase leading-tight text-neo-ink/85">
              {player.displayName}
            </span>
            {(bounceTokens[player.playerId] ?? 0) > 0 ? (
              <motion.span
                key={`${player.playerId}:${bounceTokens[player.playerId]}`}
                className={`mt-0.5 h-2.5 w-2.5 rounded-full border border-neo-ink ${ballClassName}`}
                initial={{ y: 0 }}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              />
            ) : (
              <span className={`mt-0.5 h-2.5 w-2.5 rounded-full border border-neo-ink ${ballClassName}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchHud({ hud, teamAPlayers, teamBPlayers }: MatchHudProps) {
  const hostScore = hud.hostScore ?? 0;
  const isLobbyPreview = hud.matchId.endsWith(':pre');
  const timerText =
    hud.phase === 'PreGame' && !isLobbyPreview ? 'READY' : formatSeconds(hud.secondsRemaining);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-center gap-2 text-center font-display font-black tracking-wide sm:gap-3">
          <p className="text-3xl tabular-nums text-neo-teamA sm:text-4xl">
            RED TEAM {hud.teamAPulls}
          </p>
          <span className="pb-1 text-xl text-neo-muted sm:text-2xl">|</span>
          <p className="text-4xl tabular-nums text-neo-ink sm:text-5xl">
            {timerText}
          </p>
          <span className="pb-1 text-xl text-neo-muted sm:text-2xl">|</span>
          <p className="text-3xl tabular-nums text-neo-teamB sm:text-4xl">
            BLUE TEAM {hud.teamBPulls}
          </p>
          <span className="pb-1 text-xl text-neo-muted sm:text-2xl">|</span>
          <p className="text-3xl tabular-nums text-neo-ink sm:text-4xl">
            H {hostScore}
          </p>
        </div>
        <div className="relative h-24 overflow-hidden rounded-[16px] border-4 border-neo-ink bg-gradient-to-r from-neo-teamA/25 via-neo-yellow/25 to-neo-teamB/25 sm:h-28">
          <div className="absolute inset-1.5 grid grid-cols-2 gap-1 overflow-hidden rounded-[12px] sm:inset-2">
            <div className="pr-1.5 pl-2 pt-9 pb-0 sm:pr-2 sm:pl-3 sm:pt-10">
              <TeamMarkers players={teamAPlayers} tone="teamA" />
            </div>
            <div className="pl-1.5 pr-2 pt-9 pb-0 sm:pl-2 sm:pr-3 sm:pt-10">
              <TeamMarkers players={teamBPlayers} tone="teamB" />
            </div>
          </div>
          <div className="absolute inset-y-0 left-1/2 z-20 w-[3px] -translate-x-1/2 bg-neo-ink/35" />
          <motion.div
            className="absolute top-1/2 z-30 h-[84%] w-6 -translate-x-1/2 -translate-y-1/2 border-2 border-neo-ink bg-neo-ink sm:w-7"
            style={{ clipPath: SPIKE_WALL_CLIP_PATH }}
            animate={{ left: `${hud.normalizedRopePosition}%` }}
            transition={{ type: 'spring', stiffness: 150, damping: 24 }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
