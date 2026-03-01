import type { HostPowerActionViewModel } from '@/types/ui';

export const HOST_POWER_COOLDOWN_MS_BY_ID = {
  tech_mode_burst: 20_000,
  symbols_mode_burst: 20_000,
  difficulty_up_burst: 20_000,
  flipper_burst: 20_000,
} as const;

export type HostPowerCooldownId = keyof typeof HOST_POWER_COOLDOWN_MS_BY_ID;

export function getCooldownDurationMs(powerId: string): number {
  if (powerId in HOST_POWER_COOLDOWN_MS_BY_ID) {
    return HOST_POWER_COOLDOWN_MS_BY_ID[powerId as HostPowerCooldownId];
  }
  return 0;
}

export function getCooldownRemainingMs(endsAtMs: number, nowMs: number): number {
  if (!Number.isFinite(endsAtMs) || !Number.isFinite(nowMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil(endsAtMs - nowMs));
}

export function isCooldownActive(endsAtMs: number, nowMs: number): boolean {
  return getCooldownRemainingMs(endsAtMs, nowMs) > 0;
}

export function getCooldownProgress01(endsAtMs: number, durationMs: number, nowMs: number): number {
  if (durationMs <= 0) {
    return 1;
  }
  const remaining = getCooldownRemainingMs(endsAtMs, nowMs);
  if (remaining <= 0) {
    return 1;
  }
  const elapsed = durationMs - remaining;
  const raw = elapsed / durationMs;
  return Math.max(0, Math.min(1, raw));
}

export interface HostPowerActivationGuardInput {
  power: HostPowerActionViewModel | null;
  cooldownRemainingMs: number;
}

export interface HostPowerActivationGuardResult {
  blocked: boolean;
  title: string;
  description: string;
}

export function evaluateHostPowerActivationGuard(
  input: HostPowerActivationGuardInput
): HostPowerActivationGuardResult | null {
  const power = input.power;
  if (!power) {
    return {
      blocked: true,
      title: 'Power unavailable',
      description: 'Could not resolve the selected host power.',
    };
  }

  if (!power.enabled) {
    return {
      blocked: true,
      title: 'Power unavailable',
      description: power.disabledReason ?? `${power.label} is currently unavailable.`,
    };
  }

  if (input.cooldownRemainingMs > 0) {
    const seconds = Math.max(1, Math.ceil(input.cooldownRemainingMs / 1000));
    return {
      blocked: true,
      title: 'Power recharging',
      description: `${power.label} recharging: ${seconds}s`,
    };
  }

  return null;
}
