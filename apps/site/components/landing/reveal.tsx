'use client';

import { type Variants, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

// Apparitions courtes au défilement : léger glissement + fondu, jamais de flou
// long. Respecte prefers-reduced-motion (affichage immédiat).

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, y = 12, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px -8% 0px' }}
      transition={{ duration: 0.4, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const container: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };

export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={container} initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-6% 0px' }}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
