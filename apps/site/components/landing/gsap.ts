'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/** Conditions partagées par toutes les chorégraphies de la landing. */
export const MQ = {
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
  /** Épinglages et défilement horizontal : grand écran, mouvement autorisé. */
  pin: '(prefers-reduced-motion: no-preference) and (min-width: 1024px)',
  fine: '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)',
} as const;

/** 24 images par seconde, format HH:MM:SS:FF. */
export function timecode(seconds: number) {
  const total = Math.max(0, Math.floor(seconds * 24));
  const ff = total % 24;
  const s = Math.floor(total / 24);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`;
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
