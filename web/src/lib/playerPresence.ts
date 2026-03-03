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

interface TeamColorBase {
  hue: number;
  saturation: number;
  lightness: number;
}

const SHAPES: PlayerPresenceShape[] = ['circle', 'diamond', 'hex', 'rounded-square', 'starburst'];
const STROKE_COLOR = 'hsl(221 34% 18%)';
const TEAM_COLOR_BASE: Record<'A' | 'B', TeamColorBase> = {
  A: { hue: 16, saturation: 84, lightness: 56 },
  B: { hue: 208, saturation: 71, lightness: 51 },
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

function deriveSizePx(density: number): number {
  if (density >= 40) {
    return 10;
  }
  if (density >= 30) {
    return 11;
  }
  if (density >= 20) {
    return 12;
  }
  if (density >= 12) {
    return 13;
  }
  return 14;
}

function deriveFillColor(team: 'A' | 'B', seed: number): string {
  const base = TEAM_COLOR_BASE[team];
  const hueJitter = Math.round((hashUnit(seed, 1) * 2 - 1) * 8);
  const saturationJitter = Math.round((hashUnit(seed, 2) * 2 - 1) * 6);
  const lightnessJitter = Math.round((hashUnit(seed, 3) * 2 - 1) * 7);
  const hue = base.hue + hueJitter;
  const saturation = clamp(base.saturation + saturationJitter, 58, 92);
  const lightness = clamp(base.lightness + lightnessJitter, 42, 68);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
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
  const slotOrdered = [...candidates].sort((left, right) => {
    const leftSeed = hashString(left.playerId);
    const rightSeed = hashString(right.playerId);
    if (leftSeed !== rightSeed) {
      return leftSeed - rightSeed;
    }
    return left.playerId.localeCompare(right.playerId);
  });
  const minCorrect = Math.min(...candidates.map((player) => player.correctCount));
  const maxCorrect = Math.max(...candidates.map((player) => player.correctCount));
  const leaderId = deriveTeamLeaderId({
    players: candidates,
    team: input.team,
    showEliminated: true,
  });
  const minX = 3;
  const maxX = 97;
  const minBottom = -10;
  const maxBottom = 138;
  const columnBias = density >= 28 ? 1.5 : density >= 14 ? 1.35 : 1.2;
  const columns = Math.max(3, Math.ceil(Math.sqrt(slotOrdered.length * columnBias)));
  const rows = Math.max(1, Math.ceil(slotOrdered.length / columns));
  const usableWidth = maxX - minX;
  const usableHeight = maxBottom - minBottom;
  const cellWidth = usableWidth / Math.max(1, columns);
  const cellHeight = usableHeight / Math.max(1, rows);

  return slotOrdered.map((player, index) => {
    const seed = hashString(`${player.playerId}:${input.team}:${input.lane}`);
    const shapeSeed = hashString(player.playerId);
    const row = Math.floor(index / columns);
    const col = index % columns;
    const baseX =
      columns <= 1 ? minX + usableWidth / 2 : minX + (col / (columns - 1)) * usableWidth;
    const baseBottom =
      rows <= 1 ? minBottom + usableHeight / 2 : minBottom + (row / (rows - 1)) * usableHeight;
    const xJitter = (hashUnit(seed, 0) * 2 - 1) * Math.min(2.6, cellWidth * 0.24);
    const yJitter = (hashUnit(seed, 4) * 2 - 1) * Math.min(4.1, cellHeight * 0.32);
    const xPercent = roundTo(clamp(baseX + xJitter, minX, maxX));
    const sizePx = deriveSizePx(density);
    const contributionRatio =
      (player.correctCount - minCorrect) / Math.max(1, maxCorrect - minCorrect);
    const bottomPx = clamp(
      Math.round(baseBottom + yJitter + contributionRatio * (density >= 24 ? 1.2 : 2.1)),
      0,
      156
    );
    const idleBobPx = roundTo(clamp(1 + contributionRatio * 1.7 + hashUnit(seed, 5) * 0.6, 1, 3.2));
    const tiltMagnitude = clamp(
      0.5 + contributionRatio * 0.9 + hashUnit(seed, 6) * 0.3,
      0.5,
      1.8
    );
    const idleTiltDeg = roundTo((hashUnit(seed, 7) > 0.5 ? 1 : -1) * tiltMagnitude);
    return {
      playerId: player.playerId,
      shape: SHAPES[shapeSeed % SHAPES.length] ?? 'circle',
      xPercent,
      bottomPx,
      sizePx,
      fillColor: deriveFillColor(input.team, seed),
      strokeColor: STROKE_COLOR,
      isLeader: player.playerId === leaderId,
      idleBobPx,
      idleTiltDeg,
    };
  });
}
