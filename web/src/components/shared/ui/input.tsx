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
        'neo-focus h-11 w-full rounded-[10px] border-4 border-neo-ink bg-neo-paper px-3 font-body text-sm text-neo-ink shadow-neo-sm placeholder:text-neo-muted',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';
