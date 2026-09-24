"use client";

import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function usePublicReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
}

export function MotionReveal({
  children,
  className,
  immediate = false,
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  immediate?: boolean;
  index?: number;
}) {
  const reduceMotion = usePublicReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.12 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (immediate || reduceMotion) return;
    const rect = ref.current?.getBoundingClientRect();
    // Leave initially visible content alone; only hide content below the fold.
    if (rect && (rect.top >= window.innerHeight || rect.bottom <= 0)) setReady(true);
  }, [immediate, reduceMotion]);

  const pending = ready && !inView && !reduceMotion;

  return (
    <motion.div
      ref={ref}
      className={`swcu-reveal ${className ?? ""}`}
      initial={false}
      animate={{ opacity: pending ? 0 : 1, y: pending ? 30 : 0, scale: pending ? 0.985 : 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.65, delay: reduceMotion ? 0 : Math.min(index, 5) * 0.09, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}