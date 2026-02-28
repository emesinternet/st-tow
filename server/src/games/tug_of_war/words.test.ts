import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORD_MODE_NORMAL,
  WORD_MODE_SYMBOLS,
  WORD_MODE_TECH,
} from '../../core/constants';
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
  const candidates = WORD_CATALOG.filter(
    row => row.mode === WORD_MODE_NORMAL && row.tier === 1
  );
  const keep = candidates[0];
  const excluded = new Set(candidates.slice(1).map(row => row.value));

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
