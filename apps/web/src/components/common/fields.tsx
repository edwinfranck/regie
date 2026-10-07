'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Champs à valeur locale : l'utilisateur tape librement, la valeur part au
// parent (et donc à l'autosave) à chaque frappe via onChange, sans que les
// re-rendus du serveur n'écrasent ce qui est en cours de saisie.

function useLocal<T>(value: T) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);
  return { local, setLocal, focused };
}

interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  mono?: boolean;
  disabled?: boolean;
}

export function TextField({ label, hint, value, onChange, placeholder, className, mono, disabled, type = 'text' }: FieldProps & { type?: string }) {
  const { local, setLocal, focused } = useLocal(value ?? '');
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Input
        id={id}
        type={type}
        value={local}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(mono && 'font-mono text-[13px]')}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(e.target.value);
        }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AreaField({ label, hint, value, onChange, placeholder, className, mono, disabled, rows = 4 }: FieldProps & { rows?: number }) {
  const { local, setLocal, focused } = useLocal(value ?? '');
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Textarea
        id={id}
        value={local}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={cn('resize-y', mono && 'font-mono text-[13px] leading-relaxed')}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(e.target.value);
        }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function NumberField({ label, hint, value, onChange, step = 1, min, max, className, suffix }: { label?: React.ReactNode; hint?: React.ReactNode; value: number | null | undefined; onChange: (v: number | null) => void; step?: number; min?: number; max?: number; className?: string; suffix?: string }) {
  const { local, setLocal, focused } = useLocal(value === null || value === undefined ? '' : String(value));
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={local}
          step={step}
          min={min}
          max={max}
          className={suffix ? 'pr-10' : undefined}
          onFocus={() => (focused.current = true)}
          onBlur={() => (focused.current = false)}
          onChange={(e) => {
            setLocal(e.target.value);
            const n = e.target.value === '' ? null : Number(e.target.value);
            if (n === null || Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Liste de courts éléments (interdits, thèmes, tags) : Entrée ajoute, × retire. */
export function TagInput({ label, hint, value, onChange, placeholder = 'Ajouter puis Entrée', className }: { label?: React.ReactNode; hint?: React.ReactNode; value: string[]; onChange: (v: string[]) => void; placeholder?: string; className?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...value, ...parts])]);
    setDraft('');
  };
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label>{label}</Label>}
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-[3px] focus-within:ring-ring/30">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-sm">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground" aria-label={`Retirer ${t}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={add}
          placeholder={value.length ? '' : placeholder}
          className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
