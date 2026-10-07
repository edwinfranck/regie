'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

// La capture du héros : entrée douce (montée + léger agrandissement) et un
// fondu vers le fond en bas, qui ancre l'image dans la page sans ligne nette.
export function HeroVisual({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28, scale: 0.985 }}
        animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
        className="[perspective:1600px]"
      >
        {children}
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-28 bg-gradient-to-t from-background to-transparent sm:h-40" aria-hidden />
    </div>
  );
}
