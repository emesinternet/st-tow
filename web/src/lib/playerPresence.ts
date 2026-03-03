import type { TeamPlayerViewModel } from '@/types/ui';

export type PlayerPresenceShape =
  | 'circle'
  | 'diamond'
  | 'hex'
  | 'rounded-square'
  | 'starburst';

export interface DerivePlayerPresenceInput {
  players: TeamPlayerViewModel[];
  team: 'A' | 'B';
  lane: 'left' | 'right';
  density: number;
  showEliminated: boolean;
}

export interface DeriveTeamLeaderInput {
  players: TeamPlayerViewModel[];
  team: 'A' | 'B';
  showEliminated: boolean;
}

export interface PlayerPresenceSpec {
  playerId: string;
  shape: PlayerPresenceShape;
  xPercent: number;
  bottomPx: number;
  sizePx: number;
  fillColor: string;
  strokeColor: string;
  isLeader: boolean;
  idleBobPx: number;
  idleTiltDeg: number;
}

interface PositionedSpec extends PlayerPresenceSpec {
  scoreHash: number;
}

interface TeamColorBase {
  hue: number;
  saturation: number;
  lightness: number;
}

const SHAPES: PlayerPresenceShape[] = ['circle', 'diamond', 'hex', 'rounded-square', 'starburst'];
const STROKE_COLOR = 'hsl(221 34% 18%)';
const TEAM_COLOR_BASE: Record<'A' | 'B', TeamColorBase> = {
  A: { hue: 16, saturation: 84, lightness: 54 },
  B: { hue: 208, saturation: 71, lightness: 46 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUnit(seed: number, channel: number): number {
  const mixed = Math.imul(seed ^ Math.imul(channel + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return mixed / 0xffffffff;
}

function visiblePlayers(
  players: TeamPlayerViewModel[],
  team: 'A' | 'B',
  showEliminated: boolean
): TeamPlayerViewModel[] {
  return players.filter(
    (player) =>
      player.team === team &&
      player.status !== 'Left' &&
      (showEliminated || player.status !== 'Eliminated')
  );
}

function byContributionThenId(a: TeamPlayerViewModel, b: TeamPlayerViewModel): number {
  if (a.correctCount !== b.correctCount) {
    return b.correctCount - a.correctCount;
  }
  return a.playerId.localeCompare(b.playerId);
}

function sizeBoundsByDensity(density: number): { minSize: number; maxSize: number } {
  if (density >= 18) {
    return { minSize: 12, maxSize: 20 };
  }
  if (density >= 10) {
    return { minSize: 14, maxSize: 24 };
  }
  return { minSize: 16, maxSize: 30 };
}

function deriveSizePx(
  playerCorrect: number,
  minCorrect: number,
  maxCorrect: number,
  density: number
): number {
  const { minSize, maxSize } = sizeBoundsByDensity(density);
  const ratio = (playerCorrect - minCorrect) / Math.max(1, maxCorrect - minCorrect);
  const curved = Math.pow(clamp(ratio, 0, 1), 0.65);
  return roundTo(minSize + (maxSize - minSize) * curved, 2);
}

function deriveFillColor(team: 'A' | 'B', seed: number): string {
  const base = TEAM_COLOR_BASE[team];
  const hueJitter = Math.round((hashUnit(seed, 1) * 2 - 1) * 8);
  const saturationJitter = Math.round((hashUnit(seed, 2) * 2 - 1) * 6);
  const lightnessJitter = Math.round((hashUnit(seed, 3) * 2 - 1) * 7);
  const hue = base.hue + hueJitter;
  const saturation = clamp(base.saturation + saturationJitter, 52, 92);
  const lightness = clamp(base.lightness + lightnessJitter, 35, 64);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function minGapPercent(leftSizePx: number, rightSizePx: number, density: number): number {
  const scale = density >= 18 ? 0.12 : density >= 10 ? 0.16 : 0.2;
  return clamp(((leftSizePx + rightSizePx) / 2) * scale, 1.6, 7.8);
}

function collisionPass(specs: PositionedSpec[], density: number): PositionedSpec[] {
  if (specs.length <= 1) {
    return specs;
  }

  const minX = 2.5;
  const maxX = 97.5;
  const ordered = [...specs].sort((a, b) => (a.xPercent === b.xPercent ? a.scoreHash - b.scoreHash : a.xPercent - b.xPercent));

  for (let index = 0; index < ordered.length; index += 1) {
    ordered[index] = { ...ordered[index], xPercent: clamp(ordered[index].xPercent, minX, maxX) };
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      const minimum = previous.xPercent + minGapPercent(previous.sizePx, current.sizePx, density);
      if (current.xPercent < minimum) {
        ordered[index] = { ...current, xPercent: minimum };
      }
    }

    const overflow = ordered[ordered.length - 1].xPercent - maxX;
    if (overflow > 0) {
      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        ordered[index] = { ...ordered[index], xPercent: ordered[index].xPercent - overflow };
      }
    }

    for (let index = ordered.length - 2; index >= 0; index -= 1) {
      const current = ordered[index];
      const next = ordered[index + 1];
      const maximum = next.xPercent - minGapPercent(current.sizePx, next.sizePx, density);
      if (current.xPercent > maximum) {
        ordered[index] = { ...current, xPercent: maximum };
      }
    }

    const underflow = minX - ordered[0].xPercent;
    if (underflow > 0) {
      for (let index = 0; index < ordered.length; index += 1) {
        ordered[index] = { ...ordered[index], xPercent: ordered[index].xPercent + underflow };
      }
    }
  }

  return ordered.map((spec) => ({ ...spec, xPercent: roundTo(clamp(spec.xPercent, minX, maxX), 2) }));
}

export function deriveTeamLeaderId(input: DeriveTeamLeaderInput): string | null {
  const candidates = visiblePlayers(input.players, input.team, input.showEliminated);
  if (candidates.length === 0) {
    return null;
  }

  const ordered = [...candidates].sort((left, right) => {
    if (left.correctCount !== right.correctCount) {
      return right.correctCount - left.correctCount;
    }
    if (left.lastCorrectAtMicros !== right.lastCorrectAtMicros) {
      return left.lastCorrectAtMicros > right.lastCorrectAtMicros ? -1 : 1;
    }
    const leftHash = hashString(`${left.playerId}:${input.team}`);
    const rightHash = hashString(`${right.playerId}:${input.team}`);
    return rightHash - leftHash;
  });

  return ordered[0]?.playerId ?? null;
}

export function derivePlayerPresenceSpecs(input: DerivePlayerPresenceInput): PlayerPresenceSpec[] {
  const candidates = visiblePlayers(input.players, input.team, input.showEliminated).sort(
    byContributionThenId
  );
  if (candidates.length === 0) {
    return [];
  }

  const density = Math.max(1, Math.trunc(input.density || candidates.length));
  const laneDirection = input.lane === 'left' ? -1 : 1;
  const minCorrect = Math.min(...candidates.map((player) => player.correctCount));
  const maxCorrect = Math.max(...candidates.map((player) => player.correctCount));
  const leaderId = deriveTeamLeaderId({
    players: candidates,
    team: input.team,
    showEliminated: true,
  });

  const provisional: PositionedSpec[] = candidates.map((player, index) => {
    const seed = hashString(`${player.playerId}:${input.team}`);
    const spreadCount = Math.max(1, candidates.length);
    const baseX = ((index + 0.5) / spreadCount) * 100;
    const jitterRange = density >= 18 ? 1.2 : density >= 10 ? 2.2 : 3.2;
    const jitter = (hashUnit(seed, 0) * 2 - 1) * jitterRange * laneDirection;
    const sizePx = deriveSizePx(player.correctCount, minCorrect, maxCorrect, density);
    const contributionRatio =
      (player.correctCount - minCorrect) / Math.max(1, maxCorrect - minCorrect);
    const rawBottom = (hashUnit(seed, 4) * 2 - 1) * (density >= 18 ? 1.4 : 2.4);
    const bottomPx = clamp(Math.round(rawBottom + contributionRatio * 2), 0, 6);
    const idleBobPx = roundTo(clamp(1 + contributionRatio * 1.7 + hashUnit(seed, 5) * 0.6, 1, 3.2));
    const tiltMagnitude = clamp(
      0.5 + contributionRatio * 0.9 + hashUnit(seed, 6) * 0.3,
      0.5,
      1.8
    );
    const idleTiltDeg = roundTo((hashUnit(seed, 7) > 0.5 ? 1 : -1) * tiltMagnitude);
    return {
      playerId: player.playerId,
      shape: SHAPES[seed % SHAPES.length] ?? 'circle',
      xPercent: baseX + jitter,
      bottomPx,
      sizePx,
      fillColor: deriveFillColor(input.team, seed),
      strokeColor: STROKE_COLOR,
      isLeader: player.playerId === leaderId,
      idleBobPx,
      idleTiltDeg,
      scoreHash: seed,
    };
  });

  return collisionPass(provisional, density).map(({ scoreHash: _scoreHash, ...spec }) => spec);
}
