'use client';

import { FolderInput, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { toastError } from '@/lib/client';

/** Importe un dossier de projet régie v0.1 (regie/bible.yaml, plans.yaml, refs). */
export function ImportButton() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <input
        ref={input}
        type="file"
        className="hidden"
        // @ts-expect-error attribut non standard mais pris en charge partout
        webkitdirectory=""
        multiple
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])].filter((f) => /\.(ya?ml|md|png|jpe?g|webp)$/i.test(f.name));
          if (!files.length) return;
          setBusy(true);
          try {
            const fd = new FormData();
            for (const f of files) fd.append('file', f, (f as any).webkitRelativePath || f.name);
            const res = await fetch('/api/import', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(`« ${data.title} » importé`, { description: `${data.characters} personnages, ${data.locations} lieux, ${data.shots} plans.` });
            router.push(`/projects/${data.id}`);
          } catch (err) {
            toastError(err, 'Import impossible');
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
      <Button variant="outline" size="lg" onClick={() => input.current?.click()} disabled={busy} title="Importer un dossier de projet régie v0.1">
        {busy ? <Loader2 className="animate-spin" /> : <FolderInput />} Importer
      </Button>
    </>
  );
}
