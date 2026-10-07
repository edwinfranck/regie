'use client';

import { useRef } from 'react';
import { gsap, MQ, timecode, useGSAP } from './gsap';
import { ChapterHead } from './chapter';

/* Timeline stylisée : un clip par plan du découpage. Largeurs en % de la séquence. */
const TRACKS: { name: string; clips: { label: string; from: number; to: number; accent?: boolean }[] }[] = [
  {
    name: 'V1',
    clips: [
      { label: '1A', from: 0, to: 14 },
      { label: '1B', from: 14, to: 23 },
      { label: '1C', from: 23, to: 41, accent: true },
      { label: '2A', from: 41, to: 55 },
      { label: '2B', from: 55, to: 63 },
      { label: '3A', from: 63, to: 82 },
      { label: '3B', from: 82, to: 100 },
    ],
  },
  { name: 'ST', clips: [{ label: 'sous-titre', from: 16, to: 30 }, { label: 'sous-titre', from: 58, to: 74 }] },
  { name: 'A1', clips: [{ label: 'dialogues', from: 0, to: 55 }, { label: 'dialogues', from: 63, to: 100 }] },
  { name: 'A2', clips: [{ label: 'ambiance pluie', from: 0, to: 100 }] },
];

const FORMATS = ['MP4', 'MOV', 'Scénario PDF', 'Fountain', 'DOCX', 'Final Draft', 'Storyboard PDF', 'Plans CSV', 'SRT', 'EDL', 'Projet JSON'];
const LENGTH = 4 * 60 + 50;

export function Montage() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const tc = q('[data-mtc]')[0] as HTMLElement;
        gsap.fromTo(
          q('[data-playhead]'),
          { x: 0 },
          {
            // La tête de lecture se déplace en transform : la piste mesure 100 %.
            x: () => (q('[data-lanes]')[0] as HTMLElement).offsetWidth,
            ease: 'none',
            scrollTrigger: {
              trigger: q('[data-timeline]')[0],
              start: 'top 85%',
              end: 'bottom 30%',
              scrub: 0.6,
              invalidateOnRefresh: true,
              onUpdate: (self) => (tc.textContent = timecode(self.progress * LENGTH)),
            },
          },
        );
        gsap.from(q('[data-clip]'), {
          scaleX: 0,
          transformOrigin: 'left center',
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.03,
          scrollTrigger: { trigger: q('[data-timeline]')[0], start: 'top 85%', toggleActions: 'play none none reverse' },
        });
        gsap.fromTo(
          q('[data-formats]'),
          { xPercent: 0 },
          { xPercent: -35, ease: 'none', scrollTrigger: { trigger: q('[data-formats]')[0], start: 'top bottom', end: 'bottom top', scrub: 1 } },
        );
        gsap.fromTo(
          q('[data-montage-img]'),
          { scale: 1.08 },
          { scale: 1, ease: 'none', scrollTrigger: { trigger: q('[data-montage-img]')[0], start: 'top bottom', end: 'center center', scrub: 1 } },
        );
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="montage" className="relative scroll-mt-16 overflow-hidden border-t border-border py-28 md:py-40" aria-labelledby="montage-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <ChapterHead
            n="05"
            label="Montage et export"
            id="montage-title"
            lines={[
              'Le film se monte',
              <>
                là où il a été <em>écrit</em>.
              </>,
            ]}
          />
          <p data-reveal className="max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
            Un espace plein écran, séparé du reste : séquences, pistes vidéo, audio et sous-titres, chutier, moniteur, inspecteur. L’assemblage
            part du découpage, un clip par plan. Rendu FFmpeg réel par le worker.
          </p>
        </div>

        <figure className="mt-20 overflow-hidden rounded-[3px] ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-montage-img
            src="/screens/montage.webp"
            alt="Capture de régie : l’espace de montage plein écran, avec moniteur, chutier et pistes."
            width={1920}
            height={1200}
            loading="lazy"
            decoding="async"
            className="block aspect-[16/10] h-auto w-full"
          />
        </figure>

        {/* Timeline stylisée */}
        <div data-timeline className="mt-12 rounded-[3px] border border-border bg-code p-4 sm:p-6" aria-hidden>
          <div className="mb-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>Séquence 1 · assemblage depuis le découpage</span>
            <span className="tabular-nums">
              <span className="text-signal-bright">▶</span> <span data-mtc className="text-foreground">00:00:00:00</span>
            </span>
          </div>
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3">
            <div className="grid gap-1.5">
              {TRACKS.map((t) => (
                <span key={t.name} className="flex h-9 items-center font-mono text-[11px] text-muted-foreground">
                  {t.name}
                </span>
              ))}
            </div>
            <div data-lanes className="relative grid gap-1.5">
              {TRACKS.map((t) => (
                <div key={t.name} className="relative h-9 rounded-[2px] bg-stage">
                  {t.clips.map((c, i) => (
                    <span
                      key={i}
                      data-clip
                      style={{ left: `${c.from}%`, width: `calc(${c.to - c.from}% - 2px)` }}
                      className={`absolute inset-y-0 flex items-center overflow-hidden rounded-[2px] border px-2 font-mono text-[11px] ${
                        c.accent
                          ? 'border-signal bg-[oklch(0.6_0.19_40/0.25)] text-foreground'
                          : t.name === 'V1'
                            ? 'border-border-strong bg-[oklch(0.3_0.01_60)] text-foreground'
                            : 'border-border bg-[oklch(0.22_0.008_60)] text-muted-foreground'
                      }`}
                    >
                      <span className="truncate">{c.label}</span>
                    </span>
                  ))}
                </div>
              ))}
              <span data-playhead className="pointer-events-none absolute -bottom-2 -top-2 left-0 w-px bg-signal">
                <span className="absolute -left-[5px] -top-1 size-[11px] rotate-45 bg-signal" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Formats d'export */}
      <div className="mt-24 border-y border-border py-8">
        <p className="mx-auto mb-6 max-w-[1440px] px-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:px-8">Exporter</p>
        <ul data-formats className="flex w-max gap-10 whitespace-nowrap pl-[6vw] motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:gap-y-2 motion-reduce:whitespace-normal">
          {FORMATS.map((f, i) => (
            <li key={f} className="display flex items-center gap-10 text-[clamp(2.5rem,6vw,5.5rem)] leading-none">
              <span className={i % 3 === 1 ? 'italic text-signal' : ''}>{f}</span>
              <span className="size-2 rounded-full bg-border-strong" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
