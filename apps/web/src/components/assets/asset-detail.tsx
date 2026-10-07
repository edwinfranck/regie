'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useBible, useProjectData, useProjectId } from '@/hooks/use-project';
import { del, get, patch, toastError } from '@/lib/client';
import { fmtBytes, fmtDate, fmtDuration, fmtUsd } from '@/lib/utils';
import { Choice } from '../common/choice';
import { TagInput } from '../common/fields';
import { AssetThumb, fileUrl } from '../common/media';
import { modeLabel, PAGE_OF } from '../generation/modes';
import { SetReferenceMenu } from '../generation/set-reference-menu';

export const REFERENCE_KINDS: Record<string, string> = {
  character: 'Personnage',
  location: 'Lieu',
  costume: 'Costume',
  style: 'Style',
  composition: 'Composition',
  prop: 'Objet',
};
export const TYPE_LABELS: Record<string, string> = { IMAGE: 'Image', VIDEO: 'Vidéo', AUDIO: 'Audio', DOCUMENT: 'Document' };
export const SOURCE_LABELS: Record<string, string> = { UPLOAD: 'Envoyé', GENERATED: 'Généré', IMPORTED: 'Importé' };

const LINK_KINDS = [
  { value: 'characterId', label: 'Personnage' },
  { value: 'locationId', label: 'Lieu' },
  { value: 'sceneId', label: 'Scène' },
  { value: 'shotId', label: 'Plan' },
];

/** Le panneau de détail d'un asset : aperçu, métadonnées, origine, liens, tags, référence. */
export function AssetDetail({ assetId, onClose, onDeleted }: { assetId: string; onClose: () => void; onDeleted: () => void }) {
  const projectId = useProjectId();
  const qc = useQueryClient();
  const key = ['assets', projectId, 'detail', assetId];
  const { data: a, isLoading, error } = useQuery({ queryKey: key, queryFn: () => get(`/api/projects/${projectId}/assets/${assetId}`) });
  const [name, setName] = useState('');
  const [linkKind, setLinkKind] = useState<string | null>('characterId');
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const characters = useBible('characters').data ?? [];
  const locations = useBible('locations').data ?? [];
  const scenes = useProjectData<{ scenes: any[] }>('scenes').data?.scenes ?? [];
  const shots = scenes.flatMap((s) => (s.shots ?? []).map((sh: any) => ({ ...sh, sceneNumber: s.number })));

  useEffect(() => {
    if (a) setName(a.name);
  }, [a?.id, a?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(data: Record<string, unknown>, msg?: string) {
    qc.setQueryData(key, (old: any) => (old ? { ...old, ...data } : old));
    try {
      await patch(`/api/projects/${projectId}/assets/${assetId}`, data);
      if (msg) toast.success(msg);
    } catch (e) {
      toastError(e);
    } finally {
      qc.invalidateQueries({ queryKey: ['assets'] });
    }
  }

  async function remove() {
    try {
      await del(`/api/projects/${projectId}/assets/${assetId}`);
      toast.success('Asset supprimé');
      qc.invalidateQueries({ queryKey: ['assets'] });
      onDeleted();
    } catch (e) {
      toastError(e);
    }
  }

  const targets =
    linkKind === 'characterId'
      ? characters.map((c: any) => ({ value: c.id, label: `${c.code ?? ''} ${c.name}`.trim() }))
      : linkKind === 'locationId'
        ? locations.map((l: any) => ({ value: l.id, label: `${l.code ?? ''} ${l.name}`.trim() }))
        : linkKind === 'sceneId'
          ? scenes.map((s: any) => ({ value: s.id, label: `${s.number}. ${s.title || 'Sans titre'}` }))
          : shots.map((s: any) => ({ value: s.id, label: s.code, hint: `scène ${s.sceneNumber}` }));

  const linkLabel = (l: any) =>
    l.character ? `${l.character.code} ${l.character.name}` : l.location ? `${l.location.code} ${l.location.name}` : l.shot ? `Plan ${l.shot.code}` : l.scene ? `Scène ${l.scene.number}` : l.propId ? 'Objet' : 'Lien';

  return (
    <aside className="flex h-full flex-col border-l bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-medium">Détail</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer le panneau">
          <X />
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="aspect-video" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24" />
        </div>
      ) : error || !a ? (
        <p className="p-4 text-sm text-muted-foreground">Asset introuvable. Il a peut-être été supprimé.</p>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <AssetThumb asset={a} fit="contain" controls ratio={a.type === 'AUDIO' ? undefined : a.width && a.height ? `${a.width}:${a.height}` : '16:9'} className="max-h-[50vh] rounded-sm" />

          <div className="space-y-1.5">
            <Label htmlFor="asset-name">Nom</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== a.name && save({ name: name.trim() }, 'Renommé')}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" asChild>
              <a href={fileUrl(a.id, true)}>
                <Download /> Télécharger
              </a>
            </Button>
            {a.type === 'IMAGE' && <SetReferenceMenu assetId={a.id} size="sm" />}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer « {a.name} » ?</AlertDialogTitle>
                  <AlertDialogDescription>Le fichier est effacé du stockage. S’il sert de référence à un personnage ou à un lieu, cette référence disparaît aussi.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd>
              {TYPE_LABELS[a.type] ?? a.type} <span className="text-xs text-muted-foreground">{a.mimeType}</span>
            </dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd>{SOURCE_LABELS[a.source] ?? a.source}</dd>
            <dt className="text-muted-foreground">Taille</dt>
            <dd>{fmtBytes(a.sizeBytes)}</dd>
            {a.width && a.height ? (
              <>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd>
                  {a.width} × {a.height}
                </dd>
              </>
            ) : null}
            {a.durationSec ? (
              <>
                <dt className="text-muted-foreground">Durée</dt>
                <dd>{fmtDuration(a.durationSec)}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Ajouté</dt>
            <dd>{fmtDate(a.createdAt)}</dd>
          </dl>

          {a.generation && (
            <>
              <Separator />
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Génération d’origine</h3>
                  {PAGE_OF[a.generation.capability as keyof typeof PAGE_OF] && (
                    <Link href={`/projects/${projectId}/${PAGE_OF[a.generation.capability as keyof typeof PAGE_OF]}?generation=${a.generation.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      Ouvrir <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
                <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Mode</dt>
                  <dd>{modeLabel(a.generation.mode)}</dd>
                  <dt className="text-muted-foreground">Modèle</dt>
                  <dd>{a.generation.model?.label ?? '—'}</dd>
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd>{a.generation.provider?.name ?? '—'}</dd>
                  <dt className="text-muted-foreground">Coût</dt>
                  <dd>{fmtUsd(a.generation.costUsd)}</dd>
                </dl>
                <pre className="max-h-48 overflow-y-auto rounded-sm bg-muted/50 p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap">{a.generation.prompt}</pre>
              </section>
            </>
          )}

          <Separator />
          <section className="space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">Référence</span>
                <span className="block text-xs text-muted-foreground">Rejoint la bibliothèque de références, proposée dans les générations.</span>
              </span>
              <Switch checked={a.isReference} onCheckedChange={(v) => save({ isReference: v, ...(v ? {} : { referenceKind: null }) })} />
            </label>
            {a.isReference && <Choice label="Nature de la référence" value={a.referenceKind} onChange={(v) => save({ referenceKind: v })} allowNone noneLabel="Non précisée" options={Object.entries(REFERENCE_KINDS).map(([value, label]) => ({ value, label }))} />}
          </section>

          <TagInput label="Tags" value={a.tags ?? []} onChange={(tags) => save({ tags: tags.map((t) => t.toLowerCase()).slice(0, 20) })} />

          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Liens</h3>
            {a.links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rattaché à rien. Liez-le à un personnage, un lieu, une scène ou un plan pour le retrouver depuis ces fiches.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {a.links.map((l: any) => (
                  <li key={l.id} className="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-0.5 text-sm">
                    {linkLabel(l)}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Retirer le lien"
                      onClick={async () => {
                        qc.setQueryData(key, (old: any) => (old ? { ...old, links: old.links.filter((x: any) => x.id !== l.id) } : old));
                        await save({ unlink: l.id });
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-[120px_1fr_auto] items-end gap-2">
              <Choice
                value={linkKind}
                onChange={(v) => {
                  setLinkKind(v);
                  setLinkTarget(null);
                }}
                options={LINK_KINDS}
              />
              <Choice value={linkTarget} onChange={setLinkTarget} options={targets} placeholder={targets.length ? 'Choisir…' : 'Rien à lier'} disabled={!targets.length} />
              <Button
                variant="outline"
                size="icon"
                aria-label="Ajouter le lien"
                disabled={!linkKind || !linkTarget}
                onClick={async () => {
                  await save({ link: { [linkKind!]: linkTarget } }, 'Lien ajouté');
                  setLinkTarget(null);
                }}
              >
                <Plus />
              </Button>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
