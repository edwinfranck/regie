'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const NONE = '__none__';

/** Liste déroulante stylée (jamais de <select> natif). `null` = aucune valeur. */
export function Choice({
  label,
  hint,
  value,
  onChange,
  options,
  placeholder = 'Choisir…',
  allowNone,
  noneLabel = 'Aucun',
  className,
  triggerClassName,
  disabled,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: { value: string; label: React.ReactNode; hint?: string }[];
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label>{label}</Label>}
      <Select value={value ?? (allowNone ? NONE : undefined)} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
        <SelectTrigger className={cn('w-full', triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
              {o.hint && <span className="ml-2 text-xs text-muted-foreground">{o.hint}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Sélection multiple par pastilles (personnages d'un plan, etc.). */
export function PillPicker({ label, options, value, onChange, className }: { label?: React.ReactNode; options: { value: string; label: string; title?: string }[]; value: string[]; onChange: (v: string[]) => void; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-1.5">
        {options.length === 0 && <span className="text-sm text-muted-foreground">Rien à choisir pour l’instant.</span>}
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              title={o.title}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn('rounded-sm border px-2 py-1 text-sm transition-colors', on ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
