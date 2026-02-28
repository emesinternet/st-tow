import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import dragonGif from '@/assets/dragon.gif';
import { Card, CardContent } from '@/components/shared/ui/card';
import { formatSeconds } from '@/lib/format';
import type { MatchHudViewModel, TeamPlayerViewModel } from '@/types/ui';

interface MatchHudProps {
  hud: MatchHudViewModel;
  teamAPlayers: TeamPlayerViewModel[];
  teamBPlayers: TeamPlayerViewModel[];
}

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
          (bounceTokens[player.playerId] ?? 0) > 0 ? (
            <motion.div
              key={`${player.playerId}:${bounceTokens[player.playerId]}`}
              className="flex h-7 flex-col items-center justify-end text-center"
              initial={{ y: 0 }}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <span className="max-w-[52px] truncate text-[8px] font-bold uppercase leading-tight text-neo-ink/85">
                {player.displayName}
              </span>
              <span className={`mt-0.5 h-2.5 w-2.5 rounded-full border border-neo-ink ${ballClassName}`} />
            </motion.div>
          ) : (
            <div key={player.playerId} className="flex h-7 flex-col items-center justify-end text-center">
              <span className="max-w-[52px] truncate text-[8px] font-bold uppercase leading-tight text-neo-ink/85">
                {player.displayName}
              </span>
              <span className={`mt-0.5 h-2.5 w-2.5 rounded-full border border-neo-ink ${ballClassName}`} />
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export function MatchHud({ hud, teamAPlayers, teamBPlayers }: MatchHudProps) {
  const isLobbyPreview = hud.matchId.endsWith(':pre');
  const isRpsTieBreak = hud.phase === 'TieBreakRps';
  const timerText =
    hud.phase === 'PreGame' && !isLobbyPreview
      ? 'READY'
      : isRpsTieBreak
        ? 'RPS'
        : formatSeconds(hud.secondsRemaining);
  const hostPowerPercent = Math.max(0, Math.min(100, hud.hostPowerMeter));
  const clampPercent = (value: number): number =>
    Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
  const tieZoneStartPercent = clampPercent(hud.tieZoneStartPercent);
  const tieZoneEndPercentRaw = clampPercent(hud.tieZoneEndPercent);
  const tieZoneEndPercent =
    tieZoneEndPercentRaw > tieZoneStartPercent
      ? tieZoneEndPercentRaw
      : Math.min(100, tieZoneStartPercent + 10);
  const tieZoneWidthPercent = Math.max(0, tieZoneEndPercent - tieZoneStartPercent);

  const activePowerLabel: Record<string, string> = {
    tech_mode_burst: 'Tech Mode',
    symbols_mode_burst: 'Symbols Mode',
    difficulty_up_burst: 'Difficulty Up',
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-around gap-3 text-center font-display font-black tracking-wide">
          <p className="text-4xl tabular-nums text-neo-teamA sm:text-5xl">
            {hud.teamAPulls}
          </p>
          <p className="text-4xl tabular-nums text-neo-ink sm:text-5xl">
            {timerText}
          </p>
          <p className="text-4xl tabular-nums text-neo-teamB sm:text-5xl">
            {hud.teamBPulls}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-xs font-black uppercase tracking-wide text-neo-ink">
              Host Power
            </p>
            <p className="font-mono text-xs font-bold text-neo-ink">{hostPowerPercent}%</p>
          </div>
          <div className="h-6 overflow-hidden rounded-[12px] border-4 border-neo-ink bg-neo-paper">
            <div
              className="h-full bg-neo-yellow transition-[width]"
              style={{ width: `${hostPowerPercent}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-[11px] font-bold uppercase tracking-wide text-neo-muted">
              Mode {hud.wordMode} | Tier {hud.effectiveTier}
            </p>
            {hud.activePowerId ? (
              <p className="font-display text-[11px] font-black uppercase tracking-wide text-neo-danger">
                {activePowerLabel[hud.activePowerId] ?? hud.activePowerId}
                {hud.activePowerSecondsRemaining != null
                  ? ` ${hud.activePowerSecondsRemaining}s`
                  : ''}
              </p>
            ) : (
              <p className="font-display text-[11px] font-bold uppercase tracking-wide text-neo-muted">
                No Active Effect
              </p>
            )}
          </div>
        </div>
        <div className="bg-tug-war-gradient relative h-24 overflow-hidden rounded-[16px] border-4 border-neo-ink sm:h-28">
          <div
            className="tie-zone-disco absolute inset-y-0 z-20 border-x-4 border-neo-ink/85"
            style={{
              left: `${tieZoneStartPercent}%`,
              width: `${tieZoneWidthPercent}%`,
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-[3px] bg-neo-ink/75"
            style={{ left: `calc(${tieZoneStartPercent}% - 1.5px)` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 z-30 w-[3px] bg-neo-ink/75"
            style={{ left: `calc(${tieZoneEndPercent}% - 1.5px)` }}
          />
          <div className="absolute inset-1.5 grid grid-cols-2 gap-1 overflow-hidden rounded-[12px] sm:inset-2">
            <div className="pr-1.5 pl-2 pt-9 pb-0 sm:pr-2 sm:pl-3 sm:pt-10">
              <TeamMarkers players={teamAPlayers} tone="teamA" />
            </div>
            <div className="pl-1.5 pr-2 pt-9 pb-0 sm:pl-2 sm:pr-3 sm:pt-10">
              <TeamMarkers players={teamBPlayers} tone="teamB" />
            </div>
          </div>
          <motion.img
            src={dragonGif}
            alt="Dragon rope marker"
            className="pointer-events-none absolute top-1/2 z-30 block h-[86%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            animate={{ left: `${hud.normalizedRopePosition}%` }}
            transition={{ type: 'spring', stiffness: 150, damping: 24 }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
