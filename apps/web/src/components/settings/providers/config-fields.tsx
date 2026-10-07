'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ConfigField } from './shared';

/** Les champs propres à un adapter (workflows ComfyUI, en-têtes, organisation…). */
export function ConfigFields({ fields, values, onChange }: { fields: ConfigField[]; values: Record<string, string>; onChange: (key: string, v: string) => void }) {
  return (
    <>
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`cfg-${f.key}`}>
            {f.label}
            {f.required && <span className="text-muted-foreground"> (obligatoire)</span>}
          </Label>
          {f.type === 'textarea' || f.type === 'json' ? (
            <Textarea id={`cfg-${f.key}`} value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} placeholder={f.placeholder} rows={f.type === 'json' ? 8 : 4} className="resize-y font-mono text-[13px]" spellCheck={false} />
          ) : (
            <Input id={`cfg-${f.key}`} type={f.type === 'number' ? 'number' : 'text'} value={values[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} placeholder={f.placeholder} />
          )}
          {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
        </div>
      ))}
    </>
  );
}
