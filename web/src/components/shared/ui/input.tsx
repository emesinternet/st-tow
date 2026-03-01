import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'neo-focus h-[var(--ui-control-h-md)] w-full rounded-[var(--ui-radius-md)] border-4 border-neo-ink bg-neo-paper px-[var(--space-3)] font-body text-[var(--ui-text-sm)] text-neo-ink shadow-neo-sm placeholder:text-neo-muted',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';
