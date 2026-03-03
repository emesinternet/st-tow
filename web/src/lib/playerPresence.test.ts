import assert from 'node:assert/strict';
import test from 'node:test';
import { derivePlayerPresenceSpecs, deriveTeamLeaderId } from './playerPresence';
import type { TeamPlayerViewModel } from '@/types/ui';

function makePlayer(
  playerId: string,
  team: 'A' | 'B',
  correctCount: number,
  lastCorrectAtMicros: bigint
): TeamPlayerViewModel {
  return {
    playerId,
    displayName: playerId,
    team,
    status: 'Active',
    correctCount,
    submitCount: correctCount,
    lastCorrectAtMicros,
    accuracy: 100,
    eliminatedReason: '',
    isYou: false,
  };
}

function parseHsl(value: string): { hue: number; saturation: number; lightness: number } {
  const match = value.match(/^hsl\((-?\d+)\s+(\d+)%\s+(\d+)%\)$/);
  if (!match) {
    throw new Error(`Unexpected color format: ${value}`);
  }
  return {
    hue: Number(match[1]),
    saturation: Number(match[2]),
    lightness: Number(match[3]),
  };
}

test('derivePlayerPresenceSpecs is deterministic for identical input', () => {
  const players = [
    makePlayer('a-1', 'A', 10, 100n),
    makePlayer('a-2', 'A', 6, 80n),
    makePlayer('a-3', 'A', 1, 50n),
  ];

  const input = {
    players,
    team: 'A' as const,
    lane: 'left' as const,
    density: players.length,
    showEliminated: false,
  };
  const first = derivePlayerPresenceSpecs(input);
  const second = derivePlayerPresenceSpecs(input);

  assert.deepEqual(first, second);
});

test('shape assignment stays stable for each player seed', () => {
  const players = [
    makePlayer('a-1', 'A', 1, 10n),
    makePlayer('a-2', 'A', 2, 20n),
    makePlayer('a-3', 'A', 3, 30n),
  ];

  const baseline = derivePlayerPresenceSpecs({
    players,
    team: 'A',
    lane: 'left',
    density: 3,
    showEliminated: false,
  });
  const changedCounts = derivePlayerPresenceSpecs({
    players: players.map((player) => ({ ...player, correctCount: player.correctCount * 10 })),
    team: 'A',
    lane: 'left',
    density: 3,
    showEliminated: false,
  });

  const baselineShapes = new Map(baseline.map((spec) => [spec.playerId, spec.shape] as const));
  const changedShapes = new Map(changedCounts.map((spec) => [spec.playerId, spec.shape] as const));
  assert.deepEqual(changedShapes, baselineShapes);
});

test('shape assignment stays stable even if team changes', () => {
  const playerA = makePlayer('shared-player', 'A', 5, 10n);
  const playerB = { ...playerA, team: 'B' as const };

  const shapeInTeamA =
    derivePlayerPresenceSpecs({
      players: [playerA],
      team: 'A',
      lane: 'left',
      density: 1,
      showEliminated: false,
    })[0]?.shape ?? '';
  const shapeInTeamB =
    derivePlayerPresenceSpecs({
      players: [playerB],
      team: 'B',
      lane: 'right',
      density: 1,
      showEliminated: false,
    })[0]?.shape ?? '';

  assert.equal(shapeInTeamA, shapeInTeamB);
});

test('presence sizes remain uniform across contributions', () => {
  const players = [
    makePlayer('a-low', 'A', 1, 10n),
    makePlayer('a-mid', 'A', 6, 20n),
    makePlayer('a-high', 'A', 15, 30n),
  ];
  const specs = derivePlayerPresenceSpecs({
    players,
    team: 'A',
    lane: 'left',
    density: players.length,
    showEliminated: false,
  });
  const byId = new Map(specs.map((spec) => [spec.playerId, spec] as const));

  assert.equal(byId.get('a-low')?.sizePx, byId.get('a-mid')?.sizePx);
  assert.equal(byId.get('a-mid')?.sizePx, byId.get('a-high')?.sizePx);
});

test('team color variance stays within bounded ranges', () => {
  const specsA = derivePlayerPresenceSpecs({
    players: [makePlayer('a-1', 'A', 3, 11n), makePlayer('a-2', 'A', 4, 12n)],
    team: 'A',
    lane: 'left',
    density: 2,
    showEliminated: false,
  });
  const specsB = derivePlayerPresenceSpecs({
    players: [makePlayer('b-1', 'B', 3, 11n), makePlayer('b-2', 'B', 4, 12n)],
    team: 'B',
    lane: 'right',
    density: 2,
    showEliminated: false,
  });

  for (const spec of specsA) {
    const color = parseHsl(spec.fillColor);
    assert.ok(Math.abs(color.hue - 16) <= 8);
    assert.ok(color.saturation >= 58 && color.saturation <= 92);
    assert.ok(color.lightness >= 42 && color.lightness <= 68);
  }
  for (const spec of specsB) {
    const color = parseHsl(spec.fillColor);
    assert.ok(Math.abs(color.hue - 208) <= 8);
    assert.ok(color.saturation >= 58 && color.saturation <= 92);
    assert.ok(color.lightness >= 42 && color.lightness <= 68);
  }
});

test('left lane positions span most of the available horizontal space', () => {
  const players = Array.from({ length: 24 }, (_, index) =>
    makePlayer(`a-${index}`, 'A', index % 7, BigInt(index))
  );
  const specs = derivePlayerPresenceSpecs({
    players,
    team: 'A',
    lane: 'left',
    density: players.length,
    showEliminated: false,
  });
  const minX = Math.min(...specs.map((spec) => spec.xPercent));
  const maxX = Math.max(...specs.map((spec) => spec.xPercent));
  assert.ok(minX <= 10);
  assert.ok(maxX >= 90);
  assert.ok(maxX - minX >= 72);
});

test('right lane positions span most of the available horizontal space', () => {
  const players = Array.from({ length: 24 }, (_, index) =>
    makePlayer(`b-${index}`, 'B', index % 7, BigInt(index))
  );
  const specs = derivePlayerPresenceSpecs({
    players,
    team: 'B',
    lane: 'right',
    density: players.length,
    showEliminated: false,
  });
  const minX = Math.min(...specs.map((spec) => spec.xPercent));
  const maxX = Math.max(...specs.map((spec) => spec.xPercent));
  assert.ok(minX <= 10);
  assert.ok(maxX >= 90);
  assert.ok(maxX - minX >= 72);
});

test('presence uses a wide vertical spread for dense teams', () => {
  const players = Array.from({ length: 30 }, (_, index) =>
    makePlayer(`a-${index}`, 'A', index % 5, BigInt(index))
  );
  const specs = derivePlayerPresenceSpecs({
    players,
    team: 'A',
    lane: 'left',
    density: players.length,
    showEliminated: false,
  });

  const minBottom = Math.min(...specs.map((spec) => spec.bottomPx));
  const maxBottom = Math.max(...specs.map((spec) => spec.bottomPx));
  assert.ok(maxBottom - minBottom >= 95);
});

test('deriveTeamLeaderId resolves ties by latest correct timestamp', () => {
  const players = [
    makePlayer('a-1', 'A', 10, 100n),
    makePlayer('a-2', 'A', 10, 300n),
    makePlayer('a-3', 'A', 8, 400n),
  ];

  const leaderId = deriveTeamLeaderId({
    players,
    team: 'A',
    showEliminated: false,
  });

  assert.equal(leaderId, 'a-2');
});
