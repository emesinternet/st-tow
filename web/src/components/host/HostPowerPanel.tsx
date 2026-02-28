import { useEffect } from 'react';
import { Card, CardContent } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import type { HostPowerActionViewModel } from '@/types/ui';

interface HostPowerPanelProps {
  powers: HostPowerActionViewModel[];
  onActivatePower: (powerId: string) => Promise<void>;
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
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
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

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {powers.map((power, index) => {
            const hotkey = getHotkeyForIndex(index);
            return (
              <Button
                key={power.id}
                type="button"
                size="sm"
                variant="teamB"
                disabled={!power.enabled}
                onClick={() => void onActivatePower(power.id)}
                title={power.disabledReason ?? `${power.label} (${power.cost})`}
                className="justify-between gap-3"
              >
                <span>{power.label}</span>
                <span className="inline-flex items-center gap-2">
                  <span>{power.cost}</span>
                  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border-2 border-neo-ink bg-neo-paper px-1 font-mono text-[10px] font-bold leading-none text-neo-ink">
                    {hotkey}
                  </kbd>
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
