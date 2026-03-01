import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import dragonGif from '@/assets/dragon.gif';
import { Card, CardContent } from '@/components/shared/ui/card';
import { formatSeconds } from '@/lib/format';
import type { MatchHudViewModel, TeamPlayerViewModel } from '@/types/ui';

interface MatchHudProps {
  hud: MatchHudViewModel;
  teamAPlayers: TeamPlayerViewModel[];
  teamBPlayers: TeamPlayerViewModel[];
  cameraStream?: MediaStream | null;
}

const CHEER_PHRASES = [
  'Get it!',
  'Go go!',
  'Nice!',
  'Oh yeah!',
  "Let's go!",
  'Keep going!',
  'So good!',
  'Big energy!',
  'Slay!',
  'Stay hype!',
  'Feel it!',
  'Fire!',
  'Pop off!',
  'Good vibes!',
  'Keep grooving!',
  'Dance baby!',
  'Night on fire!',
];

function randomCheerPhrase(): string {
  return CHEER_PHRASES[Math.floor(Math.random() * CHEER_PHRASES.length)] ?? CHEER_PHRASES[0];
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function TeamMarkers({
  players,
  tone,
  cameraMode = false,
  reducedMotion = false,
}: {
  players: TeamPlayerViewModel[];
  tone: 'teamA' | 'teamB';
  cameraMode?: boolean;
  reducedMotion?: boolean;
}) {
  const connected = players.filter((player) => player.status !== 'Left');
  const ballClassName = tone === 'teamA' ? 'bg-neo-teamA' : 'bg-neo-teamB';
  const prevCountsRef = useRef(new Map<string, number>());
  const [bounceTokens, setBounceTokens] = useState<Record<string, number>>({});
  const [cheerByPlayer, setCheerByPlayer] = useState<
    Record<string, { token: number; phrase: string; jumpHeight: number; bubbleLift: number }>
  >({});
  const cheerTimeoutsRef = useRef(new Map<string, number>());

  useEffect(() => {
    const triggeredPlayerIds: string[] = [];
    const disconnectedPlayerIds: string[] = [];
    const seen = new Set<string>();

    for (const player of connected) {
      seen.add(player.playerId);
      const previous = prevCountsRef.current.get(player.playerId);
      if (previous != null && player.correctCount > previous) {
        triggeredPlayerIds.push(player.playerId);
      }
      prevCountsRef.current.set(player.playerId, player.correctCount);
    }

    for (const playerId of Array.from(prevCountsRef.current.keys())) {
      if (!seen.has(playerId)) {
        prevCountsRef.current.delete(playerId);
        disconnectedPlayerIds.push(playerId);
      }
    }

    setBounceTokens((current) => {
      let changed = false;
      const next = { ...current };

      for (const playerId of triggeredPlayerIds) {
        next[playerId] = (next[playerId] ?? 0) + 1;
        changed = true;
      }

      for (const playerId of disconnectedPlayerIds) {
        if (next[playerId] != null) {
          delete next[playerId];
          changed = true;
        }
      }

      return changed ? next : current;
    });

    setCheerByPlayer((current) => {
      let changed = false;
      const next = { ...current };

      for (const playerId of disconnectedPlayerIds) {
        if (next[playerId]) {
          delete next[playerId];
          changed = true;
        }
        const timeoutId = cheerTimeoutsRef.current.get(playerId);
        if (timeoutId != null) {
          window.clearTimeout(timeoutId);
          cheerTimeoutsRef.current.delete(playerId);
        }
      }

      for (const playerId of triggeredPlayerIds) {
        const token = (next[playerId]?.token ?? 0) + 1;
        next[playerId] = {
          token,
          phrase: randomCheerPhrase(),
          jumpHeight: randomIntInclusive(8, 14),
          bubbleLift: randomIntInclusive(7, 12),
        };
        changed = true;

        const existingTimeout = cheerTimeoutsRef.current.get(playerId);
        if (existingTimeout != null) {
          window.clearTimeout(existingTimeout);
        }

        const timeoutId = window.setTimeout(() => {
          setCheerByPlayer((currentCheer) => {
            const active = currentCheer[playerId];
            if (!active || active.token !== token) {
              return currentCheer;
            }
            const after = { ...currentCheer };
            delete after[playerId];
            return after;
          });
          cheerTimeoutsRef.current.delete(playerId);
        }, 1100);
        cheerTimeoutsRef.current.set(playerId, timeoutId);
      }

      return changed ? next : current;
    });
  }, [connected]);

  useEffect(() => {
    const timeouts = cheerTimeoutsRef.current;
    return () => {
      for (const timeoutId of timeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      timeouts.clear();
    };
  }, []);

  return (
    <div className="flex h-full items-end overflow-x-auto overflow-y-visible px-1">
      <div className="grid min-h-full w-full grid-cols-[repeat(auto-fill,minmax(48px,1fr))] content-end items-end gap-x-1 gap-y-1">
        {connected.map((player) => {
          const cheer = cheerByPlayer[player.playerId];
          const bubble = cheer ? (
            <motion.span
              key={`${player.playerId}:cheer:${cheer.token}`}
              className="pointer-events-none absolute -top-3 z-10 max-w-[80px] truncate rounded-[8px] border border-neo-ink bg-neo-paper px-1 py-0.5 text-[9px] font-black uppercase leading-none text-neo-ink"
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [
                  6,
                  -Math.round(cheer.bubbleLift * 0.35),
                  -Math.round(cheer.bubbleLift * 0.65),
                  -cheer.bubbleLift,
                ],
                scale: [0.9, 1, 1, 0.98],
              }}
              transition={{ duration: reducedMotion ? 0.12 : 1.05, ease: 'easeOut' }}
            >
              {cheer.phrase}
            </motion.span>
          ) : null;

          if ((bounceTokens[player.playerId] ?? 0) > 0) {
            return (
              <motion.div
                key={`${player.playerId}:${bounceTokens[player.playerId]}`}
                className="relative flex h-7 flex-col items-center justify-end text-center"
                initial={{ y: 0 }}
                animate={{ y: reducedMotion ? 0 : [0, -(cheer?.jumpHeight ?? 10), 0] }}
                transition={{ duration: reducedMotion ? 0.12 : 0.28, ease: 'easeOut' }}
              >
                {bubble}
                <span
                  className={`max-w-[56px] truncate text-[9px] font-bold uppercase leading-tight ${
                    cameraMode ? 'text-white drop-shadow-[0_1px_0_#000]' : 'text-neo-ink/85'
                  }`}
                >
                  {player.displayName}
                </span>
                <span
                  className={`mt-0.5 h-2.5 w-2.5 rounded-full border border-neo-ink ${ballClassName}`}
                />
              </motion.div>
            );
          }

          return (
            <div
              key={player.playerId}
              className="relative flex h-7 flex-col items-center justify-end text-center"
            >
              {bubble}
              <span
                className={`max-w-[56px] truncate text-[9px] font-bold uppercase leading-tight ${
                  cameraMode ? 'text-white drop-shadow-[0_1px_0_#000]' : 'text-neo-ink/85'
                }`}
              >
                {player.displayName}
              </span>
              <span
                className={`mt-0.5 h-2.5 w-2.5 rounded-full border border-neo-ink ${ballClassName}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MatchHud({ hud, teamAPlayers, teamBPlayers, cameraStream = null }: MatchHudProps) {
  const prefersReducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isLobbyPreview = hud.matchId.endsWith(':pre');
  const isRpsTieBreak = hud.phase === 'TieBreakRps';
  const timerText =
    hud.phase === 'PreGame' && !isLobbyPreview
      ? 'READY'
      : isRpsTieBreak
        ? 'RPS'
        : formatSeconds(hud.secondsRemaining);
  const clampPercent = (value: number): number =>
    Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
  const tieZoneStartPercent = clampPercent(hud.tieZoneStartPercent);
  const tieZoneEndPercentRaw = clampPercent(hud.tieZoneEndPercent);
  const tieZoneEndPercent =
    tieZoneEndPercentRaw > tieZoneStartPercent
      ? tieZoneEndPercentRaw
      : Math.min(100, tieZoneStartPercent + 10);
  const tieZoneWidthPercent = Math.max(0, tieZoneEndPercent - tieZoneStartPercent);
  const cameraVisualMode = Boolean(cameraStream) || hud.hostCameraEnabled;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (cameraStream) {
      video.srcObject = cameraStream;
      void video.play().catch(() => {
        // Autoplay may be blocked until user interaction on some browsers.
      });
      return;
    }
    video.pause();
    video.srcObject = null;
  }, [cameraStream]);

  return (
    <Card className="overflow-visible">
      <CardContent className="space-y-3 p-4">
        <div className="flex justify-center text-center font-display font-black tracking-wide">
          <p className="text-4xl leading-none tabular-nums text-neo-ink sm:text-5xl">{timerText}</p>
        </div>
        <div className="bg-tug-war-gradient relative h-[12.5rem] overflow-hidden rounded-[16px] border-4 border-neo-ink sm:h-[15rem]">
          {cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 z-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="pointer-events-none absolute top-2 left-3 z-40 font-display text-4xl font-black tabular-nums text-neo-teamA sm:text-5xl">
            <span
              style={
                cameraVisualMode
                  ? {
                      WebkitTextStroke: '2px #000',
                      textShadow:
                        '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000',
                    }
                  : undefined
              }
            >
              {hud.teamAPulls}
            </span>
          </div>
          <div className="pointer-events-none absolute top-2 right-3 z-40 font-display text-4xl font-black tabular-nums text-neo-teamB sm:text-5xl">
            <span
              style={
                cameraVisualMode
                  ? {
                      WebkitTextStroke: '2px #000',
                      textShadow:
                        '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000',
                    }
                  : undefined
              }
            >
              {hud.teamBPulls}
            </span>
          </div>
          <div className="absolute inset-0 z-0 grid grid-cols-2">
            <div className="bg-neo-teamA/10" />
            <div className="bg-neo-teamB/10" />
          </div>
          <div
            className="tie-zone-floor absolute inset-y-0 z-10"
            style={{
              left: `${tieZoneStartPercent}%`,
              width: `${tieZoneWidthPercent}%`,
              opacity: cameraVisualMode ? 0.42 : 1,
            }}
          >
            <div className="tie-zone-floor__shimmer" />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-[3px] bg-neo-ink"
            style={{ left: `calc(${tieZoneStartPercent}% - 1.5px)` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-[3px] bg-neo-ink"
            style={{ left: `calc(${tieZoneEndPercent}% - 1.5px)` }}
          />
          <div className="pointer-events-none absolute inset-1.5 z-20 overflow-visible rounded-[12px] sm:inset-2">
            <div className="absolute inset-y-0 left-0 w-1/4 pr-1.5 pl-2 pt-16 pb-0 sm:pr-2 sm:pl-3 sm:pt-20">
              <TeamMarkers
                players={teamAPlayers}
                tone="teamA"
                cameraMode={cameraVisualMode}
                reducedMotion={Boolean(prefersReducedMotion)}
              />
            </div>
            <div className="absolute inset-y-0 right-0 w-1/4 pl-1.5 pr-2 pt-16 pb-0 sm:pl-2 sm:pr-3 sm:pt-20">
              <TeamMarkers
                players={teamBPlayers}
                tone="teamB"
                cameraMode={cameraVisualMode}
                reducedMotion={Boolean(prefersReducedMotion)}
              />
            </div>
          </div>
          <motion.img
            src={dragonGif}
            alt="Dragon rope marker"
            className="pointer-events-none absolute top-1/2 z-30 block h-[86%] max-h-[96px] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            animate={{ left: `${hud.normalizedRopePosition}%` }}
            transition={{ type: 'spring', stiffness: 150, damping: 24 }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
