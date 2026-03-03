import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import dragonGif from '@/assets/dragon.gif';
import { Badge } from '@/components/shared/ui/badge';
import { Card, CardContent } from '@/components/shared/ui/card';
import { formatSeconds } from '@/lib/format';
import { derivePlayerPresenceSpecs, type PlayerPresenceSpec } from '@/lib/playerPresence';
import type { MatchHudViewModel, TeamPlayerViewModel } from '@/types/ui';

interface MatchHudProps {
  hud: MatchHudViewModel;
  teamAPlayers: TeamPlayerViewModel[];
  teamBPlayers: TeamPlayerViewModel[];
  cameraStream?: MediaStream | null;
  latestPowerActivation?: {
    eventId: string;
    powerId: string;
    atMicros: bigint;
  } | null;
}

const POWER_DURATION_SECONDS_BY_ID: Record<string, number> = {
  flipper_burst: 20,
  tech_mode_burst: 20,
  symbols_mode_burst: 20,
};

const POWER_LABEL_BY_ID: Record<string, string> = {
  flipper_burst: 'Flipper',
  difficulty_up_burst: 'Difficulty Up',
  tech_mode_burst: 'Tech Burst',
  symbols_mode_burst: 'Symbols Burst',
};
const POWER_DURATION_FILL_CLASS_BY_ID: Record<string, string> = {
  flipper_burst: 'bg-neo-teamB',
  tech_mode_burst: 'bg-neo-teamA',
  symbols_mode_burst: 'bg-neo-success',
};
const DIFFICULTY_UP_POWER_ID = 'difficulty_up_burst';
const TIMED_POWER_IDS = new Set(['flipper_burst', 'tech_mode_burst', 'symbols_mode_burst']);

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

function PresenceShape({ spec }: { spec: PlayerPresenceSpec }) {
  const sizePx = Math.max(10, Math.round(spec.sizePx));
  const sharedProps = {
    fill: spec.fillColor,
    stroke: spec.strokeColor,
    strokeWidth: 8,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  return (
    <svg
      aria-hidden="true"
      width={sizePx}
      height={sizePx}
      viewBox="0 0 100 100"
      className="drop-shadow-[0_1px_0_rgba(0,0,0,0.15)]"
    >
      {spec.shape === 'circle' ? <circle cx="50" cy="50" r="38" {...sharedProps} /> : null}
      {spec.shape === 'diamond' ? (
        <polygon points="50,8 92,50 50,92 8,50" {...sharedProps} />
      ) : null}
      {spec.shape === 'hex' ? (
        <polygon points="24,10 76,10 94,50 76,90 24,90 6,50" {...sharedProps} />
      ) : null}
      {spec.shape === 'rounded-square' ? (
        <rect x="12" y="12" width="76" height="76" rx="18" ry="18" {...sharedProps} />
      ) : null}
      {spec.shape === 'starburst' ? (
        <polygon
          points="50,6 62,28 88,18 76,44 96,56 70,62 74,90 50,76 26,90 30,62 4,56 24,44 12,18 38,28"
          {...sharedProps}
        />
      ) : null}
    </svg>
  );
}

function LeaderCrown({ markerSizePx }: { markerSizePx: number }) {
  const crownSize = Math.max(12, Math.round(markerSizePx * 0.62));
  return (
    <svg
      aria-hidden="true"
      width={crownSize}
      height={crownSize}
      viewBox="0 0 100 100"
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ bottom: `${Math.max(10, Math.round(markerSizePx * 0.78))}px` }}
    >
      <path
        d="M10 68 L22 30 L46 52 L60 20 L74 52 L94 28 L90 68 Z"
        fill="hsl(var(--accent))"
        stroke="hsl(var(--border))"
        strokeWidth="8"
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x="12"
        y="68"
        width="76"
        height="14"
        rx="3"
        fill="hsl(var(--accent))"
        stroke="hsl(var(--border))"
        strokeWidth="8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function TeamMarkers({
  players,
  tone,
  lane,
  cameraMode = false,
  reducedMotion = false,
  showEliminated = false,
}: {
  players: TeamPlayerViewModel[];
  tone: 'teamA' | 'teamB';
  lane: 'left' | 'right';
  cameraMode?: boolean;
  reducedMotion?: boolean;
  showEliminated?: boolean;
}) {
  const connected = players.filter(
    (player) =>
      player.status !== 'Left' && (showEliminated || player.status !== 'Eliminated')
  );
  const connectedSignature = useMemo(
    () =>
      connected
        .map(
          (player) =>
            `${player.playerId}:${player.correctCount}:${player.lastCorrectAtMicros.toString()}`
        )
        .join('|'),
    [connected]
  );
  const density = connected.length;
  const nameClass =
    density >= 40
      ? 'max-w-[36px] text-[8px]'
      : density >= 24
        ? 'max-w-[48px] text-[9px]'
        : 'max-w-[64px] text-[10px]';
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

    if (triggeredPlayerIds.length === 0 && disconnectedPlayerIds.length === 0) {
      return;
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
  }, [connected, connectedSignature]);

  useEffect(() => {
    const timeouts = cheerTimeoutsRef.current;
    return () => {
      for (const timeoutId of timeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      timeouts.clear();
    };
  }, []);

  const presenceSpecs = useMemo(
    () =>
      derivePlayerPresenceSpecs({
        players: connected,
        team: tone === 'teamA' ? 'A' : 'B',
        lane,
        density,
        showEliminated,
      }),
    [connected, density, lane, showEliminated, tone]
  );
  const playersById = useMemo(
    () => new Map(connected.map((player) => [player.playerId, player] as const)),
    [connected]
  );

  return (
    <div className="relative h-full w-full overflow-visible">
      {presenceSpecs.map((spec) => {
        const player = playersById.get(spec.playerId);
        if (!player) {
          return null;
        }
        const cheer = cheerByPlayer[player.playerId];
        const bubble = cheer ? (
          <motion.span
            key={`${player.playerId}:cheer:${cheer.token}`}
            className="pointer-events-none absolute bottom-[100%] left-1/2 z-10 mb-1 max-w-[92px] -translate-x-1/2 truncate rounded-[9px] border border-neo-ink bg-neo-paper px-1.5 py-0.5 text-[10px] font-black uppercase leading-none text-neo-ink"
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

        const markerContent = (
          <>
            {bubble}
            <span
              className={`${nameClass} truncate font-bold uppercase leading-tight ${
                cameraMode ? 'text-white drop-shadow-[0_1px_0_#000]' : 'text-neo-ink/85'
              }`}
            >
              {player.displayName}
            </span>
            <span className="relative mt-0.5 inline-flex items-center justify-center">
              {spec.isLeader ? <LeaderCrown markerSizePx={spec.sizePx} /> : null}
              <PresenceShape spec={spec} />
            </span>
          </>
        );

        return (
          <div
            key={player.playerId}
            className="absolute z-20 flex flex-col items-center justify-end text-center"
            style={{
              left: `${spec.xPercent}%`,
              bottom: `${spec.bottomPx}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <motion.div
              className="flex flex-col items-center justify-end text-center"
              animate={
                reducedMotion
                  ? undefined
                  : {
                      y: [0, -spec.idleBobPx, 0],
                      rotate: [0, spec.idleTiltDeg, -spec.idleTiltDeg, 0],
                    }
              }
              transition={
                reducedMotion
                  ? undefined
                  : {
                      duration: 2.7 + spec.idleBobPx * 0.18,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
              }
            >
              {(bounceTokens[player.playerId] ?? 0) > 0 ? (
                <motion.div
                  key={`${player.playerId}:${bounceTokens[player.playerId]}`}
                  initial={{ y: 0 }}
                  animate={{ y: reducedMotion ? 0 : [0, -(cheer?.jumpHeight ?? 10), 0] }}
                  transition={{ duration: reducedMotion ? 0.12 : 0.28, ease: 'easeOut' }}
                >
                  {markerContent}
                </motion.div>
              ) : (
                markerContent
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export function MatchHud({
  hud,
  teamAPlayers,
  teamBPlayers,
  cameraStream = null,
  latestPowerActivation = null,
}: MatchHudProps) {
  const prefersReducedMotion = useReducedMotion();
  const showEliminatedMarkers = hud.phase === 'PreGame';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [difficultyUpBadgeEventId, setDifficultyUpBadgeEventId] = useState('');
  const isLobbyPreview = hud.matchId.endsWith(':pre');
  const isRpsTieBreak = hud.phase === 'TieBreakRps';
  const isSuddenDeath = hud.phase === 'SuddenDeath';
  const activePowerSeconds = hud.activePowerSecondsRemaining ?? 0;
  const hasActivePower = Boolean(hud.activePowerId) && activePowerSeconds > 0;
  const hasTimedActivePower =
    hasActivePower && TIMED_POWER_IDS.has((hud.activePowerId ?? '').toLowerCase());
  const activePowerDuration = POWER_DURATION_SECONDS_BY_ID[hud.activePowerId] ?? 20;
  const activePowerLabel = POWER_LABEL_BY_ID[hud.activePowerId] ?? 'Host Power';
  const activePowerFillClass = POWER_DURATION_FILL_CLASS_BY_ID[hud.activePowerId] ?? 'bg-neo-teamB';
  const activePowerLeftPct = Math.max(
    0,
    Math.min(100, (activePowerSeconds / Math.max(1, activePowerDuration)) * 100)
  );
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
  const badgeTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.16, ease: 'easeOut' as const };
  const showDifficultyUpBadge = difficultyUpBadgeEventId.length > 0;
  const showTimedPowerBadge = hasTimedActivePower;
  const latestPowerId = latestPowerActivation?.powerId ?? '';
  const latestPowerEventId = latestPowerActivation?.eventId ?? '';

  useEffect(() => {
    if (latestPowerId !== DIFFICULTY_UP_POWER_ID || !latestPowerEventId) {
      return;
    }

    const token = latestPowerEventId;
    setDifficultyUpBadgeEventId(token);
    const timeoutId = window.setTimeout(() => {
      setDifficultyUpBadgeEventId((current) => (current === token ? '' : current));
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [latestPowerEventId, latestPowerId]);

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
        <div className="relative">
          <AnimatePresence>
            {isSuddenDeath ? (
              <div className="pointer-events-none absolute top-0 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={badgeTransition}
                >
                  <Badge variant="danger" className="px-3 py-1 text-sm">
                    Sudden Death
                  </Badge>
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
            {showTimedPowerBadge ? (
              <div className="pointer-events-none absolute bottom-0 left-1/2 z-50 w-[min(92%,360px)] -translate-x-1/2 translate-y-1/2">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={badgeTransition}
                >
                  <div className="relative h-8 overflow-hidden rounded-[12px] border-4 border-neo-ink bg-[#1A233A] shadow-neo-sm">
                    <div
                      className={`absolute inset-y-0 left-0 transition-[width] duration-200 motion-reduce:transition-none ${activePowerFillClass}`}
                      style={{ width: `${activePowerLeftPct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-2 font-display text-xs font-black uppercase tracking-wide text-neo-paper">
                      <span>{activePowerLabel}</span>
                      <span className="font-mono">{activePowerSeconds}s</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
            {showDifficultyUpBadge ? (
              <div className="pointer-events-none absolute bottom-0 left-1/2 z-50 w-[min(92%,360px)] -translate-x-1/2 translate-y-1/2">
                <motion.div
                  key={difficultyUpBadgeEventId}
                  initial={false}
                  animate={{
                    opacity: prefersReducedMotion ? 1 : [1, 1, 1, 1, 1, 1, 0],
                    scale: prefersReducedMotion ? 1 : [1, 1.04, 1, 1.04, 1, 1.04, 1],
                    y: prefersReducedMotion ? 0 : [0, -8, 0, -8, 0, -8, 0],
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: prefersReducedMotion ? 0.01 : 1.5,
                    ease: 'easeOut',
                    times: [0, 0.12, 0.24, 0.38, 0.52, 0.7, 1],
                  }}
                >
                  <div className="inline-flex h-[var(--ui-control-h-sm)] w-full items-center justify-center gap-[var(--space-2)] rounded-[var(--ui-radius-md)] border-4 border-neo-ink bg-neo-teamB px-[var(--space-3)] font-display text-[var(--ui-text-xs)] font-bold uppercase tracking-wide text-neo-paper shadow-neo">
                    <div className="flex items-center justify-center">
                      <span>Difficulty Up</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>
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
                  lane="left"
                  cameraMode={cameraVisualMode}
                  reducedMotion={Boolean(prefersReducedMotion)}
                  showEliminated={showEliminatedMarkers}
                />
              </div>
              <div className="absolute inset-y-0 right-0 w-1/4 pl-1.5 pr-2 pt-16 pb-0 sm:pl-2 sm:pr-3 sm:pt-20">
                <TeamMarkers
                  players={teamBPlayers}
                  tone="teamB"
                  lane="right"
                  cameraMode={cameraVisualMode}
                  reducedMotion={Boolean(prefersReducedMotion)}
                  showEliminated={showEliminatedMarkers}
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
        </div>
      </CardContent>
    </Card>
  );
}
