'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Loader2, Pencil, PlugZap, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { del, patch, post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { ConfigFields } from './config-fields';
import { ModelsTable } from './models-table';
import { type AdapterMeta, buildConfig, fieldToText, type ProviderRow, type ProvidersData } from './shared';

const adapterHasTest = (message: string) => !message.includes('pas de test de connexion');

export function ProviderCard({ provider: p, adapter }: { provider: ProviderRow; adapter?: AdapterMeta }) {
  const qc = useQueryClient();
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(true);

  const setEnabled = useMutation({
    mutationFn: (enabled: boolean) => patch(`/api/providers/${p.id}`, { enabled }),
    onMutate: (enabled) => qc.setQueryData<ProvidersData>(['providers'], (d) => (d ? { ...d, providers: d.providers.map((x) => (x.id === p.id ? { ...x, enabled } : x)) } : d)),
    onError: (e) => {
      toastError(e);
      qc.invalidateQueries({ queryKey: ['providers'] });
    },
  });
  const runTest = useMutation({
    mutationFn: () => post<{ ok: boolean; message: string }>(`/api/providers/${p.id}/test`),
    onMutate: () => setTest(null),
    onSuccess: setTest,
    onError: (e) => setTest({ ok: false, message: e instanceof Error ? e.message : 'Test impossible.' }),
  });
  const remove = useMutation({
    mutationFn: () => del(`/api/providers/${p.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      toast.success(`${p.name} supprimé`);
    },
    onError: (e) => toastError(e),
  });

  const local = p.isLocal || adapter?.local;
  return (
    <section className={cn('rounded-md border bg-card', !p.enabled && 'opacity-80')}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{p.name}</h3>
            <span className="text-sm text-muted-foreground">{adapter?.label ?? p.adapter}</span>
            <Badge variant="outline">{local ? 'Local' : 'Cloud'}</Badge>
            <Badge variant="outline">{p.workspaceId ? 'Espace de travail' : 'Instance'}</Badge>
          </div>
          <p className="text-sm">
            {p.configured ? <span className="text-success">Configuré</span> : <span className="text-warning">{adapter?.needsApiKey && !p.hasKey ? 'Clé API manquante' : 'Configuration incomplète'}</span>}
            {p.hasKey && <span className="ml-2 font-mono text-xs text-muted-foreground">clé {p.apiKeyHint ?? '…'}</span>}
            {p.baseUrl && <span className="ml-2 font-mono text-xs text-muted-foreground">{p.baseUrl}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={p.enabled} disabled={!p.canManage} onCheckedChange={(v) => setEnabled.mutate(v)} /> Activé
          </label>
          {p.canManage && (
            <>
              <Button size="sm" variant="outline" onClick={() => runTest.mutate()} disabled={runTest.isPending}>
                {runTest.isPending ? <Loader2 className="animate-spin" /> : <PlugZap />} Tester la connexion
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil /> Modifier
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive">
                    <Trash2 /> Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer {p.name} ?</AlertDialogTitle>
                    <AlertDialogDescription>Ses {p.models.length} modèles et leurs routes disparaissent. Les images et vidéos déjà générées restent dans les projets.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate()}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
        {test && (
          // Certains adapters n'ont pas de test : leur réponse « ok » n'atteste rien, on l'affiche sans la présenter comme un succès.
          <p className={cn('w-full text-sm', !test.ok ? 'text-destructive' : !adapterHasTest(test.message) ? 'text-muted-foreground' : 'text-success')}>
            {!test.ok ? 'Échec — ' : adapterHasTest(test.message) ? 'Connexion réussie — ' : ''}
            {test.message}
          </p>
        )}
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-sm font-medium hover:bg-accent/50">
          <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
          {p.models.length} modèle{p.models.length > 1 ? 's' : ''}
          <span className="font-normal text-muted-foreground">· {p.models.filter((m) => m.enabled).length} actif{p.models.filter((m) => m.enabled).length > 1 ? 's' : ''}</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <ModelsTable provider={p} />
        </CollapsibleContent>
      </Collapsible>
      {editing && <EditProviderDialog provider={p} adapter={adapter} onClose={() => setEditing(false)} />}
    </section>
  );
}

function EditProviderDialog({ provider: p, adapter, onClose }: { provider: ProviderRow; adapter?: AdapterMeta; onClose: () => void }) {
  const qc = useQueryClient();
  const fields = adapter?.fields ?? [];
  const [name, setName] = useState(p.name);
  const [baseUrl, setBaseUrl] = useState(p.baseUrl ?? '');
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, fieldToText(f, p.config?.[f.key])])));
  // Sans champs déclarés, on édite la configuration brute.
  const [raw, setRaw] = useState(() => JSON.stringify(p.config ?? {}, null, 2));
  const [key, setKey] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) => patch(`/api/providers/${p.id}`, data),
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      toast.success('apiKey' in data ? (data.apiKey ? 'Clé remplacée' : 'Clé effacée') : 'Provider mis à jour');
      if ('apiKey' in data) setKey('');
      else onClose();
    },
    onError: (e) => toastError(e),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let config: Record<string, unknown>;
    if (fields.length) {
      const r = buildConfig(fields, values);
      if (r.error) return setError(r.error);
      config = { ...(p.config ?? {}), ...r.config };
      for (const f of fields) if (!(values[f.key] ?? '').trim()) delete config[f.key];
    } else {
      try {
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) return setError('La configuration doit être un objet JSON : { … }.');
        config = parsed;
      } catch (err) {
        return setError(`JSON invalide : ${(err as Error).message}`);
      }
    }
    setError(null);
    save.mutate({ name: name.trim() || p.name, baseUrl: baseUrl.trim() || null, config });
  }

  function saveKey() {
    if (!key.trim()) setConfirmClear(true);
    else save.mutate({ apiKey: key.trim() });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifier {p.name}</DialogTitle>
          <DialogDescription>{adapter?.label ?? p.adapter}</DialogDescription>
        </DialogHeader>

        {(adapter?.needsApiKey || adapter?.optionalApiKey || p.hasKey) && (
          <div className="space-y-1.5 rounded-md border p-3">
            <Label htmlFor="e-key">Clé API</Label>
            <p className="text-sm text-muted-foreground">{p.hasKey ? `Clé actuelle : ${p.apiKeyHint ?? '…'} (jamais réaffichée).` : 'Aucune clé enregistrée.'}</p>
            <div className="flex gap-2">
              <Input id="e-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={p.hasKey ? 'Nouvelle clé — vide pour effacer' : 'Coller la clé'} className="font-mono" />
              <Button type="button" variant="outline" onClick={saveKey} disabled={save.isPending || (!key.trim() && !p.hasKey)}>
                {key.trim() ? 'Enregistrer la clé' : 'Effacer la clé'}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Nom</Label>
            <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {(adapter?.needsBaseUrl || adapter?.defaultBaseUrl || p.baseUrl) && (
            <div className="space-y-1.5">
              <Label htmlFor="e-url">URL de base</Label>
              <Input id="e-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={adapter?.defaultBaseUrl} className="font-mono text-[13px]" />
            </div>
          )}
          {fields.length ? (
            <ConfigFields fields={fields} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="e-raw">Configuration (JSON)</Label>
              <Textarea id="e-raw" value={raw} onChange={(e) => setRaw(e.target.value)} rows={5} className="resize-y font-mono text-[13px]" spellCheck={false} />
              <p className="text-xs text-muted-foreground">Options propres à l’adapter. Laisser {'{}'} si vous n’en avez pas besoin.</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Effacer la clé de {p.name} ?</AlertDialogTitle>
              <AlertDialogDescription>Les générations qui passent par ce provider échoueront jusqu’à ce qu’une nouvelle clé soit posée.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={() => save.mutate({ apiKey: '' })}>Effacer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
