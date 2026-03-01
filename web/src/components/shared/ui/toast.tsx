import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 left-1/2 z-[100] m-4 flex max-h-screen w-[360px] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col gap-2 outline-none',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toastVariants = cva(
  'grid gap-1 rounded-[12px] border-4 p-3 shadow-neo data-[state=closed]:animate-[fade-enter_200ms_ease-in_reverse] data-[state=open]:animate-[fade-enter_240ms_ease-out]',
  {
    variants: {
      tone: {
        neutral: 'border-neo-ink bg-neo-paper text-neo-ink',
        success: 'border-neo-ink bg-neo-success text-neo-paper',
        danger: 'border-neo-ink bg-neo-danger text-neo-paper',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  }
);

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, tone, ...props }, ref) => (
  <ToastPrimitive.Root ref={ref} className={cn(toastVariants({ tone }), className)} {...props} />
));
Toast.displayName = ToastPrimitive.Root.displayName;

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('font-display text-sm font-extrabold uppercase tracking-wide', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn('font-body text-sm', className)} {...props} />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;
