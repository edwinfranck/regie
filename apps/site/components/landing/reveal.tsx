'use client';

import { type HTMLMotionProps, type Variants, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

// Apparitions discrètes au défilement : flou + léger glissement vers le haut.
// Respecte prefers-reduced-motion (contenu affiché immédiatement, sans flou).

const EASE = [0.22, 1, 0.36, 1] as const; // expo-out doux

export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = 'div',
  ...rest
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
} & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const reduce = useReducedMotion();
  const M = motion[as] as typeof motion.div;
  if (reduce) {
    const Tag = as;
    return (
      <Tag className={className}>{children}</Tag>
    );
  }
  return (
    <M
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px -12% 0px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </M>
  );
}

// Conteneur qui fait apparaître ses enfants l'un après l'autre.
const groupContainer: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const groupItem: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, ease: EASE } },
};

export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={groupContainer} initial="hidden" whileInView="shown" viewport={{ once: true, margin: '-10% 0px' }}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={groupItem}>
      {children}
    </motion.div>
  );
}
