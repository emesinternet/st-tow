import type { ReducerCtx } from 'spacetimedb/server';
import { WORD_MODE_NORMAL } from '../../core/constants';
import {
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
  const weights = sorted.map(tier => {
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
    entry =>
      entry.mode === mode &&
      entry.tier <= maxDifficultyTier &&
      !excluded.has(entry.value)
  );
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
      entry => entry.mode === mode && entry.tier <= maxDifficultyTier
    );
  }

  // Fallback: if mode window has no entries, degrade to normal mode.
  if (candidates.length === 0) {
    candidates = WORD_CATALOG.filter(
      entry => entry.mode === WORD_MODE_NORMAL && entry.tier <= maxDifficultyTier
    );
  }

  // Final fallback: any catalog word.
  if (candidates.length === 0) {
    candidates = [...WORD_CATALOG];
  }

  const preferredPool =
    lastWordType == null
      ? candidates
      : candidates.filter(entry => entry.type !== lastWordType);
  const mixedPool = preferredPool.length > 0 ? preferredPool : candidates;

  const pickedTier = weightedTierChoice(ctx, mixedPool);
  if (pickedTier == null) {
    return randomEntry(ctx, mixedPool);
  }

  const tierPool = mixedPool.filter(entry => entry.tier === pickedTier);
  if (tierPool.length > 0) {
    return randomEntry(ctx, tierPool);
  }

  return randomEntry(ctx, mixedPool);
}
