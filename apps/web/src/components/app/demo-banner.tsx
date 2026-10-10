import Link from 'next/link';
import { FlaskConical } from 'lucide-react';

// Bandeau du mode démo : rappelle que tout est temporaire et qu'il faut une
// clé pour générer.
export function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/50 px-4 py-1.5 text-center text-[13px] text-muted-foreground">
      <FlaskConical className="size-3.5 shrink-0 text-signal" strokeWidth={1.75} />
      <span>
        Mode démo — vos projets sont temporaires.{' '}
        <Link href="/settings/providers" className="font-medium text-foreground underline underline-offset-2">
          Ajoutez votre clé
        </Link>{' '}
        pour générer.
      </span>
    </div>
  );
}
