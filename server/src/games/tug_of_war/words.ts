import type { ReducerCtx } from 'spacetimedb/server';

const WORDS = [
  'anchor',
  'avalanche',
  'barnacle',
  'beacon',
  'blizzard',
  'caravan',
  'compass',
  'constellation',
  'drift',
  'ember',
  'falcon',
  'forge',
  'glacier',
  'harbor',
  'horizon',
  'jigsaw',
  'lantern',
  'legend',
  'marble',
  'nebula',
  'orbit',
  'paradox',
  'phoenix',
  'quartz',
  'radar',
  'ripple',
  'saffron',
  'signal',
  'summit',
  'tempest',
  'thunder',
  'tundra',
  'vortex',
  'voyage',
  'whirlwind',
  'zephyr'
];

export function pickRandomWord(ctx: ReducerCtx<any>): string {
  const idx = ctx.random.integerInRange(0, WORDS.length - 1);
  return WORDS[idx];
}
