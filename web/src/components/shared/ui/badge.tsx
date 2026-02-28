import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border-2 border-neo-ink px-2.5 py-0.5 font-display text-xs font-bold uppercase tracking-wide',
  {
    variants: {
      variant: {
        neutral: 'bg-neo-paper text-neo-ink',
        success: 'bg-neo-success text-neo-paper',
        danger: 'bg-neo-danger text-neo-paper',
        info: 'bg-neo-teamB text-neo-paper',
        teamA: 'bg-neo-teamA text-neo-ink',
        teamB: 'bg-neo-teamB text-neo-paper',
        accent: 'bg-neo-yellow text-neo-ink',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
