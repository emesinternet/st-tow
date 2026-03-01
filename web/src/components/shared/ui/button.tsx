import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'neo-focus inline-flex items-center justify-center gap-[var(--space-2)] rounded-[var(--ui-radius-md)] border-4 border-neo-ink font-display text-[var(--ui-text-sm)] font-bold uppercase tracking-wide shadow-neo transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-pressed disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-neo-yellow text-neo-ink',
        teamA: 'bg-neo-teamA text-neo-ink',
        teamB: 'bg-neo-teamB text-neo-paper',
        danger: 'bg-neo-danger text-neo-paper',
        neutral: 'bg-neo-paper text-neo-ink',
      },
      size: {
        default: 'h-[var(--ui-control-h-md)] px-[var(--space-4)]',
        sm: 'h-[var(--ui-control-h-sm)] px-[var(--space-3)] text-[var(--ui-text-xs)]',
        lg: 'h-[var(--ui-control-h-lg)] px-[var(--space-6)] text-[var(--ui-text-md)]',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
