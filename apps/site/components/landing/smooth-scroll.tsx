'use client';

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect } from 'react';
import { gsap, MQ, ScrollTrigger } from './gsap';

/**
 * Défilement doux (Lenis) synchronisé sur le ticker de GSAP, plus les
 * révélations génériques de la page : [data-reveal] et .mask-line.
 * Rien de tout cela en mouvement réduit : la page reste native et lisible.
 */
export function SmoothScroll() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(MQ.motion, () => {
      const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: { offset: -64 } });
      const raf = (time: number) => lenis.raf(time * 1000);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

      // Titres de chapitre : chaque ligne monte de derrière son masque.
      gsap.utils.toArray<HTMLElement>('.cine [data-lines]').forEach((el) => {
        gsap.from(el.querySelectorAll('.mask-line > span'), {
          yPercent: 110,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
        });
      });

      // Blocs : fondu et légère montée, groupés par conteneur.
      gsap.utils.toArray<HTMLElement>('.cine [data-reveal]').forEach((el) => {
        gsap.from(el, {
          autoAlpha: 0,
          y: 24,
          duration: 0.9,
          ease: 'power3.out',
          delay: Number(el.dataset.delay ?? 0),
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
        });
      });

      return () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
        delete (window as unknown as { __lenis?: Lenis }).__lenis;
      };
    });

    // Les images et la police d'affiche changent les mesures : on recalcule.
    const refresh = () => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    };
    // Les sections épinglées sont créées par d'autres composants : on trie une
    // première fois dès que tout est monté.
    const first = requestAnimationFrame(refresh);
    window.addEventListener('load', refresh);
    void document.fonts?.ready.then(refresh);

    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener('load', refresh);
      mm.revert();
    };
  }, []);

  return null;
}
