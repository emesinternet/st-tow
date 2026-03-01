import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Tooltip({ content, children, className, contentClassName }: TooltipProps) {
  return (
    <div className={cn('group/tooltip relative inline-flex w-full', className)}>
      {children}
      <div
        role="tooltip"
        className={cn(
          'pointer-events-none absolute top-full left-1/2 z-[60] mt-2 w-max max-w-[280px] -translate-x-1/2 rounded-[var(--ui-radius-sm)] border-4 border-neo-ink bg-neo-paper px-2 py-1 font-body text-xs leading-tight text-neo-ink opacity-0 shadow-neo-sm transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
          contentClassName
        )}
      >
        {content}
      </div>
    </div>
  );
}
