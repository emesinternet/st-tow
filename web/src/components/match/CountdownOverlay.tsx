import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface CountdownOverlayProps {
  visible: boolean;
  secondsRemaining: number | null;
}

export function CountdownOverlay({ visible, secondsRemaining }: CountdownOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const countdownValue = secondsRemaining == null ? null : Math.max(0, Math.ceil(secondsRemaining));

  return (
    <AnimatePresence>
      {visible && countdownValue != null && countdownValue > 0 ? (
        <motion.div
          key={countdownValue}
          className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.08 }}
        >
          <span className="sr-only" aria-live="assertive" aria-atomic="true">
            Match starts in {countdownValue}
          </span>
          <motion.span
            className="font-display text-[70vw] font-black leading-none text-white sm:text-[560px]"
            style={{
              WebkitTextStroke: '12px hsl(var(--fg))',
              textShadow: '22px 22px 0 hsl(var(--fg))',
            }}
            initial={{ scale: prefersReducedMotion ? 1 : 0.72 }}
            animate={{ scale: prefersReducedMotion ? 1 : [0.72, 1.14] }}
            exit={{ opacity: 0.94 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.92, ease: 'easeOut' }}
          >
            {countdownValue}
          </motion.span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
