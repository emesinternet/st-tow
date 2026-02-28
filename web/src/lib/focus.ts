import { useEffect, useRef } from 'react';

export function useStickyInputFocus(
  enabled: boolean,
  deps: ReadonlyArray<unknown> = []
): React.RefObject<HTMLInputElement | null> {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const input = ref.current;
    if (!input) {
      return;
    }

    const active = document.activeElement;
    const canRestore = active == null || active === document.body || active === input;
    if (canRestore) {
      input.focus();
      input.select();
    }
  }, [enabled, ...deps]);

  return ref;
}
