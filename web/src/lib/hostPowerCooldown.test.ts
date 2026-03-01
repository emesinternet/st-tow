import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateHostPowerActivationGuard,
  getCooldownProgress01,
  getCooldownRemainingMs,
  isCooldownActive,
} from '@/lib/hostPowerCooldown';
import type { HostPowerActionViewModel } from '@/types/ui';

test('getCooldownRemainingMs clamps negative values to zero', () => {
  assert.equal(getCooldownRemainingMs(1_000, 2_000), 0);
  assert.equal(getCooldownRemainingMs(2_000, 1_000), 1_000);
});

test('cooldown progress refills from 0 to 1 over duration', () => {
  const startsAt = 10_000;
  const duration = 20_000;
  const endsAt = startsAt + duration;

  assert.equal(getCooldownProgress01(endsAt, duration, startsAt), 0);
  assert.ok(getCooldownProgress01(endsAt, duration, startsAt + 10_000) > 0.49);
  assert.equal(getCooldownProgress01(endsAt, duration, endsAt), 1);
});

test('isCooldownActive flips from active to inactive at end boundary', () => {
  assert.equal(isCooldownActive(5_000, 4_999), true);
  assert.equal(isCooldownActive(5_000, 5_000), false);
});

test('activation guard blocks cooldown before action call', () => {
  const power: HostPowerActionViewModel = {
    id: 'tech_mode_burst',
    label: 'Tech Burst',
    cost: 1,
    enabled: true,
    disabledReason: null,
  };
  const guard = evaluateHostPowerActivationGuard({
    power,
    cooldownRemainingMs: 3_200,
  });
  assert.ok(guard);
  assert.equal(guard?.title, 'Power recharging');
  assert.match(guard?.description ?? '', /Tech Burst recharging: 4s/);
});

test('activation guard allows action when power is enabled and no cooldown remains', () => {
  const power: HostPowerActionViewModel = {
    id: 'tech_mode_burst',
    label: 'Tech Burst',
    cost: 1,
    enabled: true,
    disabledReason: null,
  };
  const guard = evaluateHostPowerActivationGuard({
    power,
    cooldownRemainingMs: 0,
  });
  assert.equal(guard, null);
});
