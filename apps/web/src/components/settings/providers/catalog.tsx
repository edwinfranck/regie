'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Choice } from '@/components/common/choice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { get, post, toastError } from '@/lib/client';
import { ConfigFields } from './config-fields';
import { DiscoverDialog } from './models-table';
import { type AdapterMeta, buildConfig, CAPABILITY_LABELS, DISCOVERABLE, type ProviderRow, type ProvidersData } from './shared';

const CUSTOM = '__custom__';

/** Le catalogue des adapters disponibles : un fournisseur = un adapter. */
export function AdapterCatalog({ adapters, isAdmin, canAdd }: { adapters: AdapterMeta[]; isAdmin: boolean; canAdd: boolean }) {
  const [adding, setAdding] = useState<AdapterMeta | null>(null);
  const compat = adapters.find((a) => a.id === 'openai-compatible');
  const custom = adapters.find((a) => a.id === 'custom-http');
  return (
    <>
      {(compat || custom) && <OtherProviderCard compat={compat} custom={custom} canAdd={canAdd} onAdd={setAdding} />}
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {adapters.map((a) => (
          <div key={a.id} className="flex flex-col gap-3 rounded-md border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{a.label}</p>
                <p className="text-sm text-muted-foreground">{a.description}</p>
              </div>
              {a.local && <Badge variant="outline">Local</Badge>}
            </div>
            <div className="mt-auto flex items-end justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {a.capabilities.map((c) => (
                  <span key={c} className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs">
                    {CAPABILITY_LABELS[c]}
                  </span>
                ))}
              </div>
              {canAdd && (
                <Button size="sm" variant="outline" onClick={() => setAdding(a)}>
                  <Plus /> Ajouter
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {adding && <AddProviderDialog key={adding.id} adapter={adding} isAdmin={isAdmin} onClose={() => setAdding(null)} />}
    </>
  );
}

/** Le chemin pour un fournisseur absent du catalogue : deux adapters génériques. */
function OtherProviderCard({ compat, custom, canAdd, onAdd }: { compat?: AdapterMeta; custom?: AdapterMeta; canAdd: boolean; onAdd: (a: AdapterMeta) => void }) {
  return (
    <div className="rounded-md border border-foreground bg-card p-4">
      <p className="font-medium">Autre fournisseur</p>
      <p className="text-sm text-muted-foreground">Votre service n’est pas dans la liste ? Presque tous se branchent par l’une de ces deux portes.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {compat && (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">API compatible OpenAI — la plupart des services</p>
            <p className="text-sm text-muted-foreground">
              DeepInfra, Together, OpenRouter, Groq, Mistral, DeepSeek… ou tout service qui documente une « OpenAI-compatible API » : choisissez-le dans la liste ou collez son URL de base, puis sa clé.
            </p>
            {canAdd && (
              <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => onAdd(compat)}>
                <Plus /> Brancher un service compatible
              </Button>
            )}
          </div>
        )}
        {custom && (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">API personnalisée — endpoint HTTP maison</p>
            <p className="text-sm text-muted-foreground">Un service qui répond en une requête à son propre format : vous décrivez le corps JSON avec des variables ({'{{prompt}}'}, {'{{seed}}'}…) et le chemin du résultat.</p>
            {canAdd && (
              <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => onAdd(custom)}>
                <Plus /> Brancher une API personnalisée
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Service asynchrone (file d’attente, sondage) ou format trop particulier : il faut un adapter dédié, voir docs/providers.md.</p>
    </div>
  );
}

function AddProviderDialog({ adapter, isAdmin, onClose }: { adapter: AdapterMeta; isAdmin: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const endpoints = adapter.endpoints ?? [];
  const [endpointId, setEndpointId] = useState<string | null>(null);
  const [name, setName] = useState(adapter.label);
  const [nameTouched, setNameTouched] = useState(false);
  const [scope, setScope] = useState<'instance' | 'workspace'>(isAdmin ? 'instance' : 'workspace');
  const [apiKey, setApiKey] = useState('');
  // Avec une liste de services, l'URL vient du service choisi : pas de défaut local trompeur.
  const [baseUrl, setBaseUrl] = useState(endpoints.length ? '' : (adapter.defaultBaseUrl ?? ''));
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ProviderRow | null>(null);
  const [discovering, setDiscovering] = useState(false);
  // Suit la liste fraîche pour que « Déjà ajouté » s'actualise pendant la découverte.
  const { data } = useQuery<ProvidersData>({ queryKey: ['providers'], queryFn: () => get('/api/providers'), enabled: !!created });

  const endpoint = endpoints.find((e) => e.id === endpointId) ?? null;
  const isLocalEndpoint = !!endpoint && /localhost|127\.0\.0\.1/.test(endpoint.baseUrl);
  const discoverable = DISCOVERABLE.has(adapter.id);
  const showKey = adapter.needsApiKey || adapter.optionalApiKey;

  function pickEndpoint(id: string | null) {
    setEndpointId(id);
    const e = endpoints.find((x) => x.id === id);
    if (e) {
      setBaseUrl(e.baseUrl);
      if (!nameTouched) setName(e.label);
    } else {
      setBaseUrl('');
      if (!nameTouched) setName(adapter.label);
    }
  }

  const create = useMutation({
    mutationFn: (payload: unknown) => post<Omit<ProviderRow, 'models' | 'configured' | 'canManage'>>('/api/providers', payload),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      if (discoverable) {
        // On enchaîne sur la découverte plutôt que de laisser l'auteur chercher le bouton.
        setCreated({ ...p, models: [], configured: true, canManage: true });
        return;
      }
      toast.success(`${p.name} branché`, { description: adapter.presets.length ? `${adapter.presets.length} modèles proposés par défaut, tous modifiables.` : 'Ajoutez ses modèles dans la liste.' });
      onClose();
    },
    onError: (e) => toastError(e),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { config, error } = buildConfig(adapter.fields ?? [], values);
    if (error) return setError(error);
    if (adapter.needsApiKey && !apiKey.trim()) return setError('La clé API est nécessaire pour ce fournisseur.');
    if (adapter.needsBaseUrl && !baseUrl.trim()) return setError(endpoints.length ? 'Choisissez un service ou collez l’URL de base de son API.' : 'L’URL de base est nécessaire.');
    setError(null);
    create.mutate({ name: name.trim() || adapter.label, adapter: adapter.id, scope, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), baseUrl: baseUrl.trim() || null, config });
  }

  if (created && discovering) return <DiscoverDialog provider={data?.providers.find((p) => p.id === created.id) ?? created} onClose={onClose} />;

  if (created)
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{created.name} est branché</DialogTitle>
            <DialogDescription>Il ne propose encore aucun modèle. La découverte interroge le service et liste ceux qu’il expose, classés en texte, image ou embedding : ajoutez ceux que régie doit utiliser.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Plus tard
            </Button>
            <Button onClick={() => setDiscovering(true)}>
              <Search /> Découvrir les modèles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Brancher {adapter.label}</DialogTitle>
          <DialogDescription>{adapter.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {endpoints.length > 0 && (
            <div className="space-y-2">
              <Choice
                label="Service"
                value={endpointId}
                onChange={(v) => pickEndpoint(v === CUSTOM ? CUSTOM : v)}
                placeholder="Choisir le service…"
                options={[
                  ...endpoints.map((e) => ({ value: e.id, label: e.label, hint: e.capabilities.map((c) => CAPABILITY_LABELS[c]).join(', ') })),
                  { value: CUSTOM, label: 'Autre service (URL personnalisée)' },
                ]}
              />
              {endpoint ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {endpoint.note && <p>{endpoint.note}</p>}
                  {endpoint.docsUrl && (
                    <a href={endpoint.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">
                      Documentation de {endpoint.label} <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              ) : endpointId === CUSTOM ? (
                <p className="text-sm text-muted-foreground">Cherchez « OpenAI-compatible » dans la documentation du service : elle donne l’URL de base, qui finit le plus souvent par /v1.</p>
              ) : null}
            </div>
          )}
          {showKey && (
            <div className="space-y-1.5">
              <Label htmlFor="p-key">
                Clé API{!adapter.needsApiKey && <span className="text-muted-foreground"> (facultative)</span>}
              </Label>
              <Input id="p-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono" placeholder={isLocalEndpoint ? 'Inutile pour un serveur local' : undefined} />
              <p className="text-xs text-muted-foreground">
                {!adapter.needsApiKey && !isLocalEndpoint && 'Nécessaire pour un service cloud. '}Chiffrée en base et jamais réaffichée : seuls ses 4 derniers caractères resteront visibles.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nom</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
            />
          </div>
          {(adapter.needsBaseUrl || adapter.defaultBaseUrl) && (
            <div className="space-y-1.5">
              <Label htmlFor="p-url">URL de base</Label>
              <Input id="p-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={endpoints.length ? 'https://api.exemple.com/v1' : (adapter.defaultBaseUrl ?? 'https://…')} className="font-mono text-[13px]" />
              {(adapter.local || isLocalEndpoint) && <p className="text-xs text-muted-foreground">Adresse vue depuis le serveur de régie (pas depuis votre navigateur).</p>}
            </div>
          )}
          {isAdmin ? (
            <Choice
              label="Portée"
              value={scope}
              onChange={(v) => setScope((v as 'instance' | 'workspace') ?? 'instance')}
              options={[
                { value: 'instance', label: 'Toute l’instance', hint: 'visible par tous les utilisateurs' },
                { value: 'workspace', label: 'Mon espace de travail' },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Ce provider sera réservé à votre espace de travail.</p>
          )}
          <ConfigFields fields={adapter.fields ?? []} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
          {adapter.docsUrl && !endpoint && (
            <a href={adapter.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
              Documentation du fournisseur <ExternalLink className="size-3.5" />
            </a>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Brancher
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
