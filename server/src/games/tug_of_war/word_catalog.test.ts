import test from 'node:test';
import assert from 'node:assert/strict';
import { WORD_MODE_NORMAL, WORD_MODE_SYMBOLS, WORD_MODE_TECH } from '../../core/constants';
import { WORD_CATALOG, countCatalogEntriesByMode } from './word_catalog';

test('word catalog has expected size and mode distribution', () => {
  assert.equal(WORD_CATALOG.length, 700);
  assert.equal(countCatalogEntriesByMode(WORD_MODE_NORMAL), 300);
  assert.equal(countCatalogEntriesByMode(WORD_MODE_TECH), 280);
  assert.equal(countCatalogEntriesByMode(WORD_MODE_SYMBOLS), 120);
});

test('word catalog entries are lowercase and globally unique', () => {
  const seen = new Set<string>();
  for (const entry of WORD_CATALOG) {
    assert.equal(entry.value, entry.value.toLowerCase());
    assert.ok(entry.tier >= 1 && entry.tier <= 5);
    assert.ok(
      entry.mode === WORD_MODE_NORMAL ||
        entry.mode === WORD_MODE_TECH ||
        entry.mode === WORD_MODE_SYMBOLS
    );
    assert.equal(seen.has(entry.value), false, `duplicate value detected: ${entry.value}`);
    seen.add(entry.value);
  }
});

test('normal mode entries are single words only', () => {
  for (const entry of WORD_CATALOG) {
    if (entry.mode !== WORD_MODE_NORMAL) {
      continue;
    }
    assert.match(
      entry.value,
      /^[a-z]+$/,
      `normal mode entry must be a single alphabetic token: ${entry.value}`
    );
  }
});
