import { AlertTriangle, CircleAlert, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const GEN_STATUS: Record<string, { label: string; className: string }> = {
  QUEUED: { label: 'En file', className: 'bg-secondary text-secondary-foreground' },
  PROCESSING: { label: 'En cours', className: 'bg-info/15 text-info' },
  COMPLETED: { label: 'Terminé', className: 'bg-success/15 text-success' },
  FAILED: { label: 'Échec', className: 'bg-destructive/15 text-destructive' },
  CANCELED: { label: 'Annulé', className: 'bg-muted text-muted-foreground' },
};

export function StatusPill({ status, progress }: { status: string; progress?: number }) {
  const s = GEN_STATUS[status] ?? GEN_STATUS.QUEUED;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium', s.className)}>
      {status === 'PROCESSING' && <Loader2 className="size-3 animate-spin" />}
      {s.label}
      {status === 'PROCESSING' && progress ? ` ${progress} %` : ''}
    </span>
  );
}

export const LEVEL = {
  error: { icon: CircleAlert, className: 'text-destructive', label: 'Erreur' },
  warning: { icon: AlertTriangle, className: 'text-warning', label: 'Avertissement' },
  info: { icon: Info, className: 'text-info', label: 'Info' },
} as const;

export interface IssueLike {
  level: 'error' | 'warning' | 'info';
  blocking?: boolean;
  where: string;
  message: string;
  fix?: string;
}

export function IssueList({ issues, empty = 'Rien à signaler.', compact }: { issues: IssueLike[]; empty?: string; compact?: boolean }) {
  if (!issues.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {issues.map((i, n) => {
        const L = LEVEL[i.level];
        return (
          <li key={n} className="flex gap-2 text-sm">
            <L.icon className={cn('mt-0.5 size-4 shrink-0', L.className)} />
            <div className="min-w-0">
              <span className="font-medium">{i.where}</span> — {i.message}
              {i.blocking && <span className="ml-1.5 rounded-sm bg-destructive/10 px-1 text-xs text-destructive">bloquant</span>}
              {!compact && i.fix && <p className="text-muted-foreground">{i.fix}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Le code court d'une entité de la bible : CH1, L2, 12A. */
export const Code = ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={cn('rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs', className)}>{children}</span>;
