import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import { Tooltip } from '@/components/shared/ui/tooltip';
import type { HostPowerActionViewModel } from '@/types/ui';

interface HostPowerPanelProps {
  powers: HostPowerActionViewModel[];
  onActivatePower: (powerId: string) => Promise<void>;
}

const HOST_POWER_TOOLTIPS: Record<string, string> = {
  tech_mode_burst: 'Tech Burst: Switches all active words to tech-style words for 20 seconds.',
  symbols_mode_burst:
    'Symbols Burst: Switches all active words to symbol-heavy words for 20 seconds.',
  difficulty_up_burst:
    'Difficulty Up: Boosts difficulty by one tier for 20 seconds and rerolls active words.',
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

export function HostPowerPanel({ powers, onActivatePower }: HostPowerPanelProps) {
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
      if (!Number.isInteger(index) || index < 0 || index >= powers.length) {
        return;
      }

      const power = powers[index];
      if (!power || !power.enabled) {
        return;
      }

      event.preventDefault();
      void onActivatePower(power.id);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onActivatePower, powers]);

  if (!powers.length) {
    return null;
  }

  const getPowerTooltip = (power: HostPowerActionViewModel): string => {
    const base = HOST_POWER_TOOLTIPS[power.id] ?? `${power.label}: Activates a temporary effect.`;
    if (power.enabled) {
      return `${base} Cost: ${power.cost}.`;
    }
    return `${base} Cost: ${power.cost}. ${power.disabledReason ?? 'Currently unavailable.'}`;
  };

  return (
    <Card>
      <CardHeader className="mb-1">
        <CardTitle>Host Power-Ups</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {powers.map((power, index) => {
            const hotkey = getHotkeyForIndex(index);
            return (
              <Tooltip key={power.id} content={getPowerTooltip(power)}>
                <Button
                  type="button"
                  size="sm"
                  variant="teamB"
                  disabled={!power.enabled}
                  onClick={() => void onActivatePower(power.id)}
                  className="w-full justify-between gap-3"
                >
                  <span>{power.label}</span>
                  <span className="inline-flex items-center gap-2">
                    <span>{power.cost}</span>
                    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border-2 border-neo-ink bg-neo-paper px-1 font-mono text-[10px] font-bold leading-none text-neo-ink">
                      {hotkey}
                    </kbd>
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
