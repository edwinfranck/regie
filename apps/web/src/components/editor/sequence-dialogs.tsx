'use client';

import { ASPECT_RATIOS } from '@regie/core';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Choice } from '@/components/common/choice';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { post, toastError } from '@/lib/client';

export const timelinesKey = (projectId: string) => ['editor', 'timelines', projectId];

export interface TimelineRow {
  id: string;
  name: string;
  fps: number;
  aspectRatio: string | null;
  durationSec: number;
  clipCount: number;
  updatedAt: string;
  createdAt: string;
  lastRender: { status: string; assetId: string | null; createdAt: string } | null;
}

/** Nouvelle séquence : vide ou assemblée depuis le découpage ; signale les plans sans média. */
export function NewSequenceDialog({ open, onOpenChange, projectId, projectAspect, defaultName, onOpen }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string; projectAspect?: string; defaultName: string; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [aspect, setAspect] = useState<string | null>(null);
  const [assemble, setAssemble] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; missing: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setAspect(null);
      setAssemble(true);
      setResult(null);
    }
  }, [open, defaultName]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await post<{ id: string; missing: string[] }>(`/api/projects/${projectId}/timelines`, { name: name.trim() || defaultName, assemble, aspectRatio: aspect });
      qc.invalidateQueries({ queryKey: timelinesKey(projectId) });
      if (r.missing?.length) setResult({ id: r.id, missing: r.missing });
      else {
        onOpenChange(false);
        onOpen(r.id);
      }
    } catch (e) {
      toastError(e, 'Création impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{result ? 'Séquence créée' : 'Nouvelle séquence'}</DialogTitle>
          <DialogDescription>{result ? 'Certains plans n’ont encore ni vidéo ni image : ils laissent un trou de leur durée sur V1.' : 'Une séquence est un montage du film : pistes vidéo, son et sous-titres.'}</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-2">
            <p className="text-sm">
              {result.missing.length} plan{result.missing.length > 1 ? 's' : ''} sans média :
            </p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {result.missing.map((c) => (
                <span key={c} className="rounded-sm border px-1.5 py-0.5 font-mono text-xs">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="seq-name">Nom</Label>
              <Input id="seq-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} autoFocus />
            </div>
            <Choice label="Format" value={aspect} onChange={setAspect} allowNone noneLabel={`Celui du projet (${projectAspect ?? '16:9'})`} options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))} />
            <label className="flex items-start gap-2.5">
              <Checkbox checked={assemble} onCheckedChange={(v) => setAssemble(v === true)} className="mt-0.5" />
              <span className="text-sm">
                Assembler depuis le découpage
                <span className="block text-xs text-muted-foreground">Un clip par plan sur V1, dans l’ordre (la vidéo du plan, sinon son image), et les dialogues en sous-titres.</span>
              </span>
            </label>
            <button type="submit" hidden />
          </form>
        )}
        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onOpen(result.id);
                }}
              >
                Ouvrir dans le montage
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={create} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Créer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RenameDialog({ open, onOpenChange, name, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; name: string; onSubmit: (name: string) => void | Promise<void> }) {
  const [value, setValue] = useState(name);
  useEffect(() => {
    if (open) setValue(name);
  }, [open, name]);
  const submit = async () => {
    if (!value.trim()) return;
    await onSubmit(value.trim());
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Renommer la séquence</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={160} autoFocus aria-label="Nom de la séquence" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!value.trim()}>
            Renommer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
