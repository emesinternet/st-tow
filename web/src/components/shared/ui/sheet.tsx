import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const SheetPortal = DialogPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-40 bg-neo-ink/40 backdrop-blur-[1px]', className)}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 bg-neo-paper p-[var(--space-4)] shadow-neo transition data-[state=open]:animate-[fade-enter_220ms_ease-out] data-[state=closed]:animate-[fade-enter_140ms_ease-in_reverse]',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b-[var(--ui-border-lg)] border-neo-ink',
        bottom: 'inset-x-0 bottom-0 border-t-[var(--ui-border-lg)] border-neo-ink',
        left: 'inset-y-0 left-0 h-full w-[88vw] border-r-[var(--ui-border-lg)] border-neo-ink sm:max-w-md',
        right:
          'inset-y-0 right-0 h-full w-[88vw] border-l-[var(--ui-border-lg)] border-neo-ink sm:max-w-md',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
);

export interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = 'right', ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="neo-focus absolute right-[var(--space-3)] top-[var(--space-3)] rounded-[var(--ui-radius-sm)] border-[var(--ui-border-sm)] border-neo-ink bg-neo-paper p-1.5 shadow-neo-sm">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-[var(--space-3)] ui-stack-1 text-left', className)} {...props} />
);

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-display text-[var(--ui-text-xl)] font-extrabold', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;
