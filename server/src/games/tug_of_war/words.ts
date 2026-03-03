import type { ReducerCtx } from 'spacetimedb/server';
import { WORD_MODE_NORMAL, WORD_MODE_SYMBOLS } from '../../core/constants';
import {
  MAX_WORD_DIFFICULTY_TIER,
  MIN_WORD_DIFFICULTY_TIER,
  WORD_CATALOG,
  type WordDifficultyTier,
  type WordEntry,
  type WordMode,
  type WordType,
} from './word_catalog';

export interface PickWordForContextInput {
  mode: WordMode;
  maxDifficultyTier: WordDifficultyTier;
  excluded: ReadonlySet<string>;
  lastWordType?: WordType | null;
}

function randomEntry<T>(ctx: ReducerCtx<any>, entries: readonly T[]): T {
  const idx = ctx.random.integerInRange(0, entries.length - 1);
  return entries[idx];
}

function weightedTierChoice(
  ctx: ReducerCtx<any>,
  candidates: readonly WordEntry[]
): WordDifficultyTier | null {
  const tiers = new Set<WordDifficultyTier>();
  for (const candidate of candidates) {
    tiers.add(candidate.tier);
  }
  if (tiers.size === 0) {
    return null;
  }

  const sorted = Array.from(tiers).sort((a, b) => a - b);
  let totalWeight = 0;
  const weights = sorted.map((tier) => {
    const weight = tier * tier;
    totalWeight += weight;
    return { tier, weight };
  });

  const roll = ctx.random.integerInRange(1, totalWeight);
  let running = 0;
  for (const row of weights) {
    running += row.weight;
    if (roll <= running) {
      return row.tier;
    }
  }

  return weights[weights.length - 1].tier;
}

function selectCandidates(
  mode: WordMode,
  maxDifficultyTier: WordDifficultyTier,
  excluded: ReadonlySet<string>
): WordEntry[] {
  return WORD_CATALOG.filter(
    (entry) => entry.mode === mode && entry.tier <= maxDifficultyTier && !excluded.has(entry.value)
  );
}

function minimumSelectableTier(
  mode: WordMode,
  maxDifficultyTier: WordDifficultyTier
): WordDifficultyTier {
  if (mode === WORD_MODE_NORMAL) {
    if (maxDifficultyTier <= 2) {
      return MIN_WORD_DIFFICULTY_TIER;
    }
    if (maxDifficultyTier <= 3) {
      return 2;
    }
    if (maxDifficultyTier <= 4) {
      return 3;
    }
    if (maxDifficultyTier <= 5) {
      return 4;
    }
    if (maxDifficultyTier <= 6) {
      return 5;
    }
    if (maxDifficultyTier <= 7) {
      return 6;
    }
    return 7;
  }

  if (mode === WORD_MODE_SYMBOLS) {
    if (maxDifficultyTier <= 3) {
      return MIN_WORD_DIFFICULTY_TIER;
    }
    if (maxDifficultyTier <= 5) {
      return 2;
    }
    if (maxDifficultyTier <= 7) {
      return 3;
    }
    return 4;
  }

  if (maxDifficultyTier <= 2) {
    return MIN_WORD_DIFFICULTY_TIER;
  }
  if (maxDifficultyTier <= 4) {
    return 2;
  }
  if (maxDifficultyTier <= 6) {
    return 3;
  }
  if (maxDifficultyTier <= 7) {
    return 4;
  }
  return 5;
}

function minimumLengthForDifficulty(mode: WordMode, maxDifficultyTier: WordDifficultyTier): number {
  if (mode !== WORD_MODE_NORMAL) {
    return 0;
  }

  if (maxDifficultyTier >= 8) {
    return 10;
  }
  if (maxDifficultyTier >= 7) {
    return 9;
  }
  if (maxDifficultyTier >= 6) {
    return 8;
  }
  if (maxDifficultyTier >= 5) {
    return 7;
  }
  return 0;
}

function constrainToDifficultyWindow(
  mode: WordMode,
  candidates: readonly WordEntry[],
  maxDifficultyTier: WordDifficultyTier
): WordEntry[] {
  if (maxDifficultyTier >= MAX_WORD_DIFFICULTY_TIER) {
    const topHalfFloor = mode === WORD_MODE_SYMBOLS ? 4 : 5;
    const topHalf = candidates.filter((entry) => entry.tier >= topHalfFloor);
    if (topHalf.length > 0) {
      candidates = topHalf;
    }
  }

  const minTier = minimumSelectableTier(mode, maxDifficultyTier);
  let constrained = candidates.filter(
    (entry) => entry.tier >= minTier && entry.tier <= maxDifficultyTier
  );
  if (constrained.length === 0) {
    constrained = [...candidates];
  }

  const minLength = minimumLengthForDifficulty(mode, maxDifficultyTier);
  if (minLength <= 0) {
    return constrained;
  }

  const lengthFiltered = constrained.filter((entry) => entry.value.length >= minLength);
  return lengthFiltered.length > 0 ? lengthFiltered : constrained;
}

export function pickWordForContext(
  ctx: ReducerCtx<any>,
  input: PickWordForContextInput
): WordEntry {
  const { mode, maxDifficultyTier, excluded, lastWordType } = input;
  let candidates = selectCandidates(mode, maxDifficultyTier, excluded);

  // Fallback: if exclusion exhausted this mode/tier window, ignore exclusions.
  if (candidates.length === 0) {
    candidates = WORD_CATALOG.filter(
      (entry) => entry.mode === mode && entry.tier <= maxDifficultyTier
    );
  }

  // Fallback: if mode window has no entries, degrade to normal mode.
  if (candidates.length === 0) {
    candidates = WORD_CATALOG.filter(
      (entry) => entry.mode === WORD_MODE_NORMAL && entry.tier <= maxDifficultyTier
    );
  }

  // Final fallback: any catalog word.
  if (candidates.length === 0) {
    candidates = [...WORD_CATALOG];
  }

  const difficultyWindowPool = constrainToDifficultyWindow(mode, candidates, maxDifficultyTier);
  const preferredPool =
    lastWordType == null
      ? difficultyWindowPool
      : difficultyWindowPool.filter((entry) => entry.type !== lastWordType);
  const mixedPool = preferredPool.length > 0 ? preferredPool : difficultyWindowPool;

  const pickedTier = weightedTierChoice(ctx, mixedPool);
  if (pickedTier == null) {
    return randomEntry(ctx, mixedPool);
  }

  const tierPool = mixedPool.filter((entry) => entry.tier === pickedTier);
  if (tierPool.length > 0) {
    return randomEntry(ctx, tierPool);
  }

  return randomEntry(ctx, mixedPool);
}
