'use client';

import { MapPin, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AssetThumb } from '@/components/common/media';
import { usable, useModels } from '@/components/common/model-picker';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { Code } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useBible, useBibleMutations, useProjectId } from '@/hooks/use-project';
import { post, toastError } from '@/lib/client';

// Ce que l'IA peut remplir dans une fiche de lieu, avec le type attendu :
// le reste de sa réponse est ignoré plutôt que refusé par le schéma.
const TEXT_KEYS = ['short', 'block', 'architecture', 'era', 'palette', 'lighting', 'weather', 'mood', 'textures', 'objects', 'sound'] as const;
function cleanDraft(d: Record<string, any> = {}) {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_KEYS) if (typeof d[k] === 'string') out[k] = d[k];
  if (typeof d.interior === 'boolean') out.interior = d.interior;
  if (Array.isArray(d.never)) out.never = d.never.filter((x: unknown) => typeof x === 'string' && x.trim()).map((x: string) => x.slice(0, 200)).slice(0, 80);
  return out;
}

export default function LocationsPage() {
  const projectId = useProjectId();
  const { data: locations, isLoading } = useBible('locations');
  const { create } = useBibleMutations('locations');
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState(false);
  const { data: text = [] } = useModels('TEXT');
  const canDraft = text.some(usable);

  useEffect(() => {
    if (search.get('new')) setOpen(true);
  }, [search]);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      let fields: Record<string, unknown> = {};
      if (draft && canDraft) {
        const r = await post(`/api/projects/${projectId}/ai/location`, { name, notes: notes || undefined });
        fields = cleanDraft(r.data);
      } else if (notes.trim()) {
        // Sans IA, les notes deviennent le point de départ de la description.
        fields = { block: notes.trim() };
      }
      const row = await create.mutateAsync({ name: name.trim(), ...fields });
      router.push(`/projects/${projectId}/locations/${row.id}`);
    } catch (e) {
      toastError(e);
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Lieux"
        description="Les décors du film. La description gelée et la plaque de référence sont injectées dans chaque plan tourné sur place."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Nouveau lieu
          </Button>
        }
      />
      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : !locations?.length ? (
          <EmptyState icon={MapPin} title="Aucun lieu" description="Créez le premier décor : un nom suffit, l’IA peut proposer la description." action={<Button onClick={() => setOpen(true)}>Créer un lieu</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
            {locations.map((l: any) => (
              <Link key={l.id} href={`/projects/${projectId}/locations/${l.id}`} className="overflow-hidden rounded-md border bg-card transition-colors hover:border-foreground/40">
                <AssetThumb asset={l.refAssetId ? { id: l.refAssetId, type: 'IMAGE' } : null} ratio="16:9" className="border-b" />
                <div className="space-y-1 p-3">
                  <div className="flex items-center gap-2">
                    <Code>{l.code}</Code>
                    <span className="truncate font-medium">{l.name}</span>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{l.short || l.mood || 'Fiche à compléter'}</p>
                  <div className="flex flex-wrap gap-1 pt-1 text-xs">
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5">{l.interior ? 'intérieur' : 'extérieur'}</span>
                    {l.frozen && <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-background">gelé</span>}
                    {!l.refAssetId && <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 text-warning">sans plaque</span>}
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5">{l._count?.scenes ?? 0} scènes</span>
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5">{l._count?.shots ?? 0} plans</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau lieu</DialogTitle>
            <DialogDescription>Un nom, et ce que vous voyez déjà de ce décor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Intérieur ou extérieur, époque, matériaux, ambiance, ce qu’on y entend…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={draft && canDraft} disabled={!canDraft} onCheckedChange={(v) => setDraft(!!v)} />
              <Sparkles className="size-4" /> Développer la fiche avec l’IA
              {!canDraft && <span className="text-muted-foreground">(aucun modèle de texte configuré)</span>}
            </label>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={busy || !name.trim()}>
              {busy ? (draft && canDraft ? 'L’IA écrit la fiche…' : 'Création…') : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
