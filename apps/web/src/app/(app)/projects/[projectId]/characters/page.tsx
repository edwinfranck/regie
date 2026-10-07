'use client';

import { Plus, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { AssetThumb } from '@/components/common/media';
import { Code } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useModels, usable } from '@/components/common/model-picker';
import { useBible, useBibleMutations, useProjectId } from '@/hooks/use-project';
import { post, toastError } from '@/lib/client';

export default function CharactersPage() {
  const projectId = useProjectId();
  const { data: characters, isLoading } = useBible('characters');
  const { create } = useBibleMutations('characters');
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
      // Avec l'IA : on crée la fiche avec la proposition, que l'auteur relira.
      let fields: Record<string, unknown> = {};
      if (draft && canDraft) {
        const r = await post(`/api/projects/${projectId}/ai/character`, { name, notes: notes || undefined });
        const { heightM, ...rest } = r.data ?? {};
        fields = { ...rest, heightM: typeof heightM === 'number' ? heightM : null };
      }
      const row = await create.mutateAsync({ name: name.trim(), ...fields, profile: { ...(fields.profile as object), ...(notes && !draft ? { backstory: notes } : {}) } });
      router.push(`/projects/${projectId}/characters/${row.id}`);
    } catch (e) {
      toastError(e);
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Personnages"
        description="La bible des personnages. La description gelée et la feuille de référence sont injectées dans chaque plan où ils apparaissent."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Nouveau personnage
          </Button>
        }
      />
      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : !characters?.length ? (
          <EmptyState icon={Users} title="Aucun personnage" description="Créez le premier : un nom suffit, l’IA peut proposer le reste." action={<Button onClick={() => setOpen(true)}>Créer un personnage</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {characters.map((c: any) => (
              <Link key={c.id} href={`/projects/${projectId}/characters/${c.id}`} className="overflow-hidden rounded-md border bg-card transition-colors hover:border-foreground/40">
                <AssetThumb asset={c.refAssetId ? { id: c.refAssetId, type: 'IMAGE' } : null} ratio="3:4" className="border-b" />
                <div className="space-y-1 p-3">
                  <div className="flex items-center gap-2">
                    <Code>{c.code}</Code>
                    <span className="truncate font-medium">{c.name}</span>
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{c.role || c.short || 'Fiche à compléter'}</p>
                  <div className="flex flex-wrap gap-1 pt-1 text-xs">
                    {c.frozen && <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-background">gelé</span>}
                    {!c.refAssetId && <span className="rounded-sm bg-warning/15 px-1.5 py-0.5 text-warning">sans feuille</span>}
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5">{c._count?.shots ?? 0} plans</span>
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
            <DialogTitle>Nouveau personnage</DialogTitle>
            <DialogDescription>Un nom, et ce que vous savez déjà de lui ou d’elle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Âge, rôle dans l’histoire, apparence, ce qui le rend unique…" />
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
