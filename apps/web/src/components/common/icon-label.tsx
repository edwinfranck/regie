import type { LucideIcon } from 'lucide-react';

/** Libellé de champ précédé d'une icône discrète, pour aérer les pages denses. */
export function IconLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" strokeWidth={2} />
      {children}
    </span>
  );
}
