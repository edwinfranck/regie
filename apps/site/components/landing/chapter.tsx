import type { ReactNode } from 'react';

/**
 * En-tête de chapitre : numéro de scène façon claquette, puis un grand titre
 * d'affiche dont chaque ligne est révélée derrière un masque (voir SmoothScroll).
 */
export function ChapterHead({
  n,
  label,
  id,
  lines,
  className = '',
  size = 'text-[clamp(2.75rem,8vw,8.5rem)]',
}: {
  n: string;
  label: string;
  id: string;
  lines: ReactNode[];
  className?: string;
  size?: string;
}) {
  return (
    <div className={className}>
      <p data-reveal className="mb-8 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="inline-flex items-center gap-2 rounded-[2px] border border-border-strong px-2 py-1 text-foreground">
          <span className="text-signal-bright">SC.</span>
          {n}
        </span>
        <span className="h-px w-10 bg-border-strong" />
        {label}
      </p>
      <h2 id={id} data-lines className={`display text-balance ${size}`}>
        {lines.map((l, i) => (
          <span key={i} className="mask-line">
            <span>{l}</span>
          </span>
        ))}
      </h2>
    </div>
  );
}
