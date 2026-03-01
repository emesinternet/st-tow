import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Tooltip } from '@/components/shared/ui/tooltip';
import type { HostPowerActionViewModel, HostPowerCooldownState } from '@/types/ui';

interface HostPowerPanelProps {
  hostPowerMeter: number;
  powers: HostPowerActionViewModel[];
  cooldownsByPowerId: Record<string, HostPowerCooldownState>;
  onActivatePower: (powerId: string) => Promise<void>;
}

const HOST_POWER_TOOLTIPS: Record<string, string> = {
  tech_mode_burst: 'Tech Burst: Switches all active words to tech-style words for 20 seconds.',
  symbols_mode_burst:
    'Symbols Burst: Switches all active words to symbol-heavy words for 20 seconds.',
  difficulty_up_burst:
    'Difficulty Up: Boosts difficulty by one tier for 20 seconds and rerolls active words.',
  flipper_burst:
    'Flipper: Randomly mirrors 2 to 4 letters in active words so they appear backwards.',
};

function isHotkeyBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  ) {
    return true;
  }
  return (
    target.closest('input, textarea, select, button, a, [role="button"], [role="textbox"]') != null
  );
}

function getHotkeyForIndex(index: number): string {
  if (index < 9) {
    return String(index + 1);
  }
  if (index === 9) {
    return '0';
  }
  return String(index + 1);
}

export function HostPowerPanel({
  hostPowerMeter,
  powers,
  cooldownsByPowerId,
  onActivatePower,
}: HostPowerPanelProps) {
  const orderedPowers = useMemo(
    () =>
      [...powers].sort((left, right) => {
        if (left.cost !== right.cost) {
          return left.cost - right.cost;
        }
        return left.label.localeCompare(right.label);
      }),
    [powers]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.repeat) {
        return;
      }

      const target = event.target;
      if (isHotkeyBlockedTarget(target)) {
        return;
      }

      const key = event.key;
      const index = key === '0' ? 9 : Number.parseInt(key, 10) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= orderedPowers.length) {
        return;
      }

      const power = orderedPowers[index];
      if (!power || !power.enabled || (cooldownsByPowerId[power.id]?.active ?? false)) {
        return;
      }

      event.preventDefault();
      void onActivatePower(power.id);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cooldownsByPowerId, onActivatePower, orderedPowers]);

  if (!powers.length) {
    return null;
  }
  const hostPowerValue = Math.max(0, Math.trunc(hostPowerMeter));
  const hostPowerPercent = Math.max(0, Math.min(100, hostPowerValue));

  const getPowerTooltip = (power: HostPowerActionViewModel): string => {
    const cooldown = cooldownsByPowerId[power.id] ?? {
      active: false,
      remainingMs: 0,
      progress01: 1,
    };
    const base = HOST_POWER_TOOLTIPS[power.id] ?? `${power.label}: Activates a temporary effect.`;
    if (!power.enabled && power.disabledReason) {
      return `${base} ${power.disabledReason}`;
    }
    if (cooldown.active) {
      const seconds = Math.max(1, Math.ceil(cooldown.remainingMs / 1000));
      return `${base} Cost: ${power.cost}. Cooling down: ${seconds}s.`;
    }
    if (power.enabled) {
      return `${base} Cost: ${power.cost}. Ready.`;
    }
    return `${base} Cost: ${power.cost}. ${power.disabledReason ?? 'Currently unavailable.'}`;
  };

  return (
    <Card>
      <CardHeader className="mb-1">
        <CardTitle>Use Power to Cause Choas</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative mb-2 h-7 overflow-hidden rounded-[12px] border-4 border-neo-ink bg-neo-paper">
          <div className="h-full bg-neo-yellow transition-[width]" style={{ width: `${hostPowerPercent}%` }} />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-2">
            <p className="font-display text-xs font-black uppercase tracking-wide text-neo-ink">
              Host Power
            </p>
            <p className="font-mono text-xs font-bold text-neo-ink">{hostPowerValue}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {orderedPowers.map((power, index) => {
            const hotkey = getHotkeyForIndex(index);
            const cooldown = cooldownsByPowerId[power.id] ?? {
              active: false,
              remainingMs: 0,
              progress01: 1,
            };
            const disabled = !power.enabled || cooldown.active;
            const progressPct = Math.max(0, Math.min(100, cooldown.progress01 * 100));
            return (
              <Tooltip key={power.id} content={getPowerTooltip(power)}>
                <Button
                  type="button"
                  size="sm"
                  variant="teamB"
                  disabled={disabled}
                  aria-disabled={disabled}
                  onClick={() => void onActivatePower(power.id)}
                  className="relative w-full justify-between gap-3 overflow-hidden"
                >
                  {cooldown.active ? (
                    <>
                      <span className="pointer-events-none absolute inset-0 bg-neo-paper/45" />
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 bg-neo-teamB transition-[width] duration-100 motion-reduce:transition-none"
                        style={{ width: `${progressPct}%` }}
                      />
                    </>
                  ) : null}
                  <span className="relative z-10 flex w-full items-center justify-between gap-3">
                    <span>{power.label}</span>
                    <span className="inline-flex items-center gap-2">
                      <span>{power.cost}</span>
                      <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border-2 border-neo-ink bg-neo-paper px-1 font-mono text-[10px] font-bold leading-none text-neo-ink">
                        {hotkey}
                      </kbd>
                    </span>
                  </span>
                </Button>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
