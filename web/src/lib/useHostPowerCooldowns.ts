import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCooldownDurationMs,
  getCooldownProgress01,
  getCooldownRemainingMs,
  isCooldownActive,
} from '@/lib/hostPowerCooldown';
import type { HostPowerCooldownState, UiRole } from '@/types/ui';

interface UseHostPowerCooldownsOptions {
  role: UiRole;
  lobbyId: string;
  matchId: string;
}

export function useHostPowerCooldowns({ role, lobbyId, matchId }: UseHostPowerCooldownsOptions) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cooldownEndsByPowerId, setCooldownEndsByPowerId] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 100);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setCooldownEndsByPowerId({});
  }, [lobbyId, matchId, role]);

  useEffect(() => {
    setCooldownEndsByPowerId((current) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [powerId, endsAtMs] of Object.entries(current)) {
        if (endsAtMs > nowMs) {
          next[powerId] = endsAtMs;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [nowMs]);

  const clearCooldowns = useCallback(() => {
    setCooldownEndsByPowerId({});
  }, []);

  const startCooldown = useCallback((powerId: string, startAtMs = Date.now()) => {
    const durationMs = getCooldownDurationMs(powerId);
    if (durationMs <= 0) {
      return;
    }
    setCooldownEndsByPowerId((current) => ({
      ...current,
      [powerId]: startAtMs + durationMs,
    }));
    setNowMs(startAtMs);
  }, []);

  const getCooldownState = useCallback(
    (powerId: string): HostPowerCooldownState => {
      const endsAtMs = cooldownEndsByPowerId[powerId] ?? 0;
      const durationMs = getCooldownDurationMs(powerId);
      const remainingMs = getCooldownRemainingMs(endsAtMs, nowMs);
      const active = isCooldownActive(endsAtMs, nowMs);
      const progress01 = active ? getCooldownProgress01(endsAtMs, durationMs, nowMs) : 1;
      return {
        active,
        remainingMs,
        progress01,
      };
    },
    [cooldownEndsByPowerId, nowMs]
  );

  const cooldownStatesByPowerId = useMemo(() => {
    const next: Record<string, HostPowerCooldownState> = {};
    for (const powerId of Object.keys(cooldownEndsByPowerId)) {
      next[powerId] = getCooldownState(powerId);
    }
    return next;
  }, [cooldownEndsByPowerId, getCooldownState]);

  return {
    nowMs,
    cooldownEndsByPowerId,
    cooldownStatesByPowerId,
    startCooldown,
    getCooldownState,
    clearCooldowns,
  };
}
