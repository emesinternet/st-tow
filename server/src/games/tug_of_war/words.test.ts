import test from 'node:test';
import assert from 'node:assert/strict';
import { WORD_MODE_NORMAL, WORD_MODE_SYMBOLS, WORD_MODE_TECH } from '../../core/constants';
import { WORD_CATALOG } from './word_catalog';
import { pickWordForContext } from './words';

function makeCtx(preferMax = true): any {
  return {
    random: {
      integerInRange: (min: number, max: number) => (preferMax ? max : min),
    },
  };
}

test('pickWordForContext respects mode and max difficulty tier', () => {
  const picked = pickWordForContext(makeCtx(), {
    mode: WORD_MODE_TECH,
    maxDifficultyTier: 2,
    excluded: new Set<string>(),
    lastWordType: null,
  });

  assert.equal(picked.mode, WORD_MODE_TECH);
  assert.ok(picked.tier <= 2);
});

test('pickWordForContext honors exclusion set when candidates remain', () => {
  const candidates = WORD_CATALOG.filter((row) => row.mode === WORD_MODE_NORMAL && row.tier === 1);
  const keep = candidates[0];
  const excluded = new Set(candidates.slice(1).map((row) => row.value));

  const picked = pickWordForContext(makeCtx(false), {
    mode: WORD_MODE_NORMAL,
    maxDifficultyTier: 1,
    excluded,
    lastWordType: null,
  });

  assert.equal(picked.value, keep.value);
});

test('pickWordForContext avoids repeating the last word type when alternatives exist', () => {
  const picked = pickWordForContext(makeCtx(), {
    mode: WORD_MODE_SYMBOLS,
    maxDifficultyTier: 1,
    excluded: new Set<string>(),
    lastWordType: 'brace_pattern',
  });

  assert.notEqual(picked.type, 'brace_pattern');
});

test('pickWordForContext never returns a tier above maxDifficultyTier up to tier 8', () => {
  for (const maxDifficultyTier of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    const picked = pickWordForContext(makeCtx(), {
      mode: WORD_MODE_TECH,
      maxDifficultyTier,
      excluded: new Set<string>(),
      lastWordType: null,
    });
    assert.ok(
      picked.tier <= maxDifficultyTier,
      `picked tier ${picked.tier} exceeds max ${maxDifficultyTier}`
    );
  }
});

test('pickWordForContext keeps higher difficulty away from bottom tiers', () => {
  const midPicked = pickWordForContext(makeCtx(false), {
    mode: WORD_MODE_NORMAL,
    maxDifficultyTier: 3,
    excluded: new Set<string>(),
    lastWordType: null,
  });
  assert.ok(midPicked.tier >= 2, `expected tier >= 2 for max 3, got ${midPicked.tier}`);

  const topPicked = pickWordForContext(makeCtx(false), {
    mode: WORD_MODE_NORMAL,
    maxDifficultyTier: 8,
    excluded: new Set<string>(),
    lastWordType: null,
  });
  assert.ok(topPicked.tier >= 7, `expected tier >= 7 for max 8, got ${topPicked.tier}`);
  assert.ok(
    topPicked.value.length >= 10,
    `expected length >= 10 for max 8, got ${topPicked.value}`
  );
});

test('pickWordForContext keeps symbols mode less aggressive at high tier', () => {
  const topSymbols = pickWordForContext(makeCtx(false), {
    mode: WORD_MODE_SYMBOLS,
    maxDifficultyTier: 8,
    excluded: new Set<string>(),
    lastWordType: null,
  });
  assert.ok(
    topSymbols.tier >= 4,
    `expected symbols tier >= 4 at max 8, got ${topSymbols.tier}`
  );
});
