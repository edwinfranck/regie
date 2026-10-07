import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ImageIcon } from 'lucide-react';

export type ScreenName =
  | 'hero'
  | 'concept'
  | 'characters'
  | 'script'
  | 'scene'
  | 'storyboard'
  | 'prompts'
  | 'montage'
  | 'graph'
  | 'providers';

/**
 * Une capture de l'application dans un cadre de fenêtre sobre.
 * Tant que public/screens/<name>.webp n'existe pas, le cadre reste vide avec sa
 * légende : aucune fausse capture dessinée. La présence est vérifiée au build.
 */
export function Screen({
  name,
  caption,
  priority = false,
  className = '',
}: {
  name: ScreenName;
  caption: string;
  priority?: boolean;
  className?: string;
}) {
  const file = `/screens/${name}.webp?v=2`;
  const present = existsSync(join(process.cwd(), 'public', 'screens', `${name}.webp`));

  return (
    <figure className={`overflow-hidden rounded-[6px] border border-border-strong/70 bg-background shadow-[var(--shadow-frame)] ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-muted/60 px-3">
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">régie — {caption}</span>
      </div>
      {present ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file}
          alt={`Capture de régie : ${caption}`}
          className="block aspect-[16/10] w-full object-cover object-top"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
      ) : (
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 bg-stage px-6 text-center">
          <ImageIcon className="size-5 text-muted-foreground/70" strokeWidth={1.5} />
          <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
          <span className="font-mono text-[11px] text-muted-foreground/70">capture à venir · {file}</span>
        </div>
      )}
    </figure>
  );
}
