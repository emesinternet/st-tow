import test from 'node:test';
import assert from 'node:assert/strict';
import { WORD_MODE_NORMAL, WORD_MODE_SYMBOLS, WORD_MODE_TECH } from '../../core/constants';
import {
  WORD_CATALOG,
  WORD_DIFFICULTY_TIERS,
  countCatalogEntriesByMode,
  type WordMode,
  type WordType,
} from './word_catalog';

function canonicalKey(value: string): string {
  return value.toLowerCase().replace(/[-_/:.]/g, '');
}

test('word catalog has expected size and mode distribution', () => {
  assert.equal(WORD_CATALOG.length, 2000);
  assert.equal(countCatalogEntriesByMode(WORD_MODE_NORMAL), 1000);
  assert.equal(countCatalogEntriesByMode(WORD_MODE_TECH), 600);
  assert.equal(countCatalogEntriesByMode(WORD_MODE_SYMBOLS), 400);
});

test('word catalog canonical keys are globally unique', () => {
  const seen = new Set<string>();
  for (const entry of WORD_CATALOG) {
    const key = canonicalKey(entry.value);
    assert.equal(seen.has(key), false, `duplicate canonical key detected: ${entry.value}`);
    seen.add(key);
  }
});

test('word catalog enforces readability and charset constraints', () => {
  const normalPattern = /^[a-z]+$/;
  const techSymbolPattern = /^[a-z{}\[\]()<>+\-*/=!?&|:._~]+$/;

  for (const entry of WORD_CATALOG) {
    assert.equal(entry.value, entry.value.toLowerCase());
    assert.equal(/\s/.test(entry.value), false, `entry contains whitespace: ${entry.value}`);
    assert.equal(/[0-9]/.test(entry.value), false, `entry contains digit: ${entry.value}`);
    assert.equal(/["'`]/.test(entry.value), false, `entry contains quote/backtick: ${entry.value}`);
    assert.ok(entry.tier >= 1 && entry.tier <= 8, `tier out of range: ${entry.value}`);

    if (entry.mode === WORD_MODE_NORMAL) {
      assert.match(entry.value, normalPattern, `normal token invalid chars: ${entry.value}`);
      assert.ok(entry.value.length <= 14, `normal token too long: ${entry.value}`);
      continue;
    }

    assert.match(entry.value, techSymbolPattern, `tech/symbol token invalid chars: ${entry.value}`);
    assert.ok(entry.value.length <= 18, `tech/symbol token too long: ${entry.value}`);
  }
});

test('symbols mode entries stay symbol-first and avoid plain-word runs', () => {
  for (const entry of WORD_CATALOG) {
    if (entry.mode !== WORD_MODE_SYMBOLS) {
      continue;
    }

    // Every symbol token should include at least one non-letter character.
    assert.ok(/[^a-z]/.test(entry.value), `symbols token lacks symbols: ${entry.value}`);

    // Prevent long word-like segments (for example "that+=would").
    const alphaRuns = entry.value.match(/[a-z]+/g) ?? [];
    for (const run of alphaRuns) {
      assert.ok(run.length <= 2, `symbols token has long alpha run: ${entry.value}`);
    }
  }
});

test('word catalog enforces chain guards for symbols and tech tokens', () => {
  for (const entry of WORD_CATALOG) {
    if (entry.mode === WORD_MODE_NORMAL) {
      continue;
    }
    assert.ok((entry.value.match(/->/g)?.length ?? 0) <= 1, `multi-hop -> token: ${entry.value}`);
    assert.ok((entry.value.match(/=>/g)?.length ?? 0) <= 1, `multi-hop => token: ${entry.value}`);
    assert.ok((entry.value.match(/::/g)?.length ?? 0) <= 1, `repeated :: token: ${entry.value}`);
    assert.ok((entry.value.match(/&&/g)?.length ?? 0) <= 1, `repeated && token: ${entry.value}`);
    assert.ok((entry.value.match(/\|\|/g)?.length ?? 0) <= 1, `repeated || token: ${entry.value}`);
  }
});

test('word catalog matches exact per-tier per-type quotas', () => {
  const counts = new Map<string, number>();
  for (const entry of WORD_CATALOG) {
    const key = `${entry.mode}:${entry.tier}:${entry.type}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const expected: Array<[WordMode, WordType, readonly number[]]> = [
    [WORD_MODE_NORMAL, 'object', [32, 31, 31, 31, 32, 31, 31, 31]],
    [WORD_MODE_NORMAL, 'action', [31, 32, 31, 31, 31, 32, 31, 31]],
    [WORD_MODE_NORMAL, 'abstract', [31, 31, 32, 31, 31, 31, 32, 31]],
    [WORD_MODE_NORMAL, 'nature', [31, 31, 31, 32, 31, 31, 31, 32]],
    [WORD_MODE_TECH, 'command', [19, 19, 19, 18, 19, 19, 19, 18]],
    [WORD_MODE_TECH, 'flag', [19, 19, 18, 19, 19, 19, 18, 19]],
    [WORD_MODE_TECH, 'operator', [19, 18, 19, 19, 19, 18, 19, 19]],
    [WORD_MODE_TECH, 'path_token', [18, 19, 19, 19, 18, 19, 19, 19]],
    [WORD_MODE_SYMBOLS, 'brace_pattern', [17, 17, 16, 17, 17, 16, 17, 17]],
    [WORD_MODE_SYMBOLS, 'pipe_pattern', [17, 16, 17, 17, 16, 17, 17, 16]],
    [WORD_MODE_SYMBOLS, 'mixed_token', [16, 17, 17, 16, 17, 17, 16, 17]],
  ];

  for (const [mode, type, tierCounts] of expected) {
    for (let index = 0; index < tierCounts.length; index += 1) {
      const tier = WORD_DIFFICULTY_TIERS[index];
      const key = `${mode}:${tier}:${type}`;
      assert.equal(counts.get(key) ?? 0, tierCounts[index], `quota mismatch for ${key}`);
    }
  }
});
