"use client";

/**
 * PageTransition — wraps page content with a smooth fade+slide entrance.
 *
 * Uses Framer Motion AnimatePresence with the URL pathname as the key so
 * every route change triggers the animation. Falls back to instant render
 * when prefers-reduced-motion is set.
 *
 * Usage (in a layout or page):
 *   <PageTransition>
 *     {children}
 *   </PageTransition>
 */

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

const variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        /* Prevent layout shift during exit */
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
