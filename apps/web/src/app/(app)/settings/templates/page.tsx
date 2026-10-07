'use client';

import { fillTemplate, TEMPLATE_CATEGORIES, templateVariables } from '@regie/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, FileText, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Choice } from '@/components/common/choice';
import { AreaField, TextField } from '@/components/common/fields';
import { EmptyState, PageHeader, Panel } from '@/components/common/page-header';
import { categoryLabel } from '@/components/settings/template-labels';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutosave } from '@/hooks/use-autosave';
import { del, get, patch, post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  projectId: string | null;
  category: string;
  name: string;
  body: string;
  variables: string[];
  project: { id: string; title: string } | null;
}

const INSTANCE = 'instance';
const CATEGORY_OPTIONS = TEMPLATE_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }));

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<string>(INSTANCE);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const projectId = scope === INSTANCE ? null : scope;
  const key = ['templates', projectId];

  const isAdmin = useQuery({ queryKey: ['providers'], queryFn: () => get('/api/providers'), staleTime: 60_000, select: (d: any) => !!d.isAdmin }).data;
  const projects = useQuery<{ id: string; title: string }[]>({ queryKey: ['projects'], queryFn: () => get('/api/projects') }).data ?? [];
  const { data: templates = [], isLoading } = useQuery<Template[]>({ queryKey: key, queryFn: () => get(`/api/templates${projectId ? `?projectId=${projectId}` : ''}`) });

  const visible = templates.filter((t) => !category || t.category === category);
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const canEdit = (t: Template) => (t.projectId ? true : !!isAdmin);
  const canCreate = !!projectId || !!isAdmin;

  // L'autosave n'est pas indexé par template : on vide la file avant de changer de sélection.
  const { queue, flush } = useAutosave<Partial<Template>>(async (p) => {
    if (!selectedId) return;
    const row = await patch<Template>(`/api/templates/${selectedId}`, p);
    qc.setQueryData<Template[]>(key, (old) => old?.map((t) => (t.id === row.id ? row : t)));
  });
  const set = (p: Partial<Template>) => {
    if (!selected) return;
    const next = { ...p, ...(p.body !== undefined ? { variables: templateVariables(p.body) } : {}) };
    qc.setQueryData<Template[]>(key, (old) => old?.map((t) => (t.id === selected.id ? { ...t, ...next } : t)));
    queue(p);
  };
  const select = async (id: string | null) => {
    await flush();
    setSelectedId(id);
  };

  const create = useMutation({
    mutationFn: () => post<Template>('/api/templates', { category: category ?? 'IMAGE', name: 'Nouveau template', body: 'A {{subject}} in {{location}}, {{lighting}}.', projectId }),
    onSuccess: async (t) => {
      qc.setQueryData<Template[]>(key, (old) => [...(old ?? []), t]);
      await select(t.id);
    },
    onError: (e) => toastError(e),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/api/templates/${id}`),
    onSuccess: (_, id) => {
      qc.setQueryData<Template[]>(key, (old) => old?.filter((t) => t.id !== id));
      setSelectedId(null);
    },
    onError: (e) => toastError(e),
  });

  return (
    <div>
      <PageHeader
        title="Templates de prompts"
        description="Des prompts réutilisables avec des {{variables}} à remplir. Ceux de l’instance servent à tous ; ceux d’un projet restent dans le projet."
        actions={
          <Button onClick={() => create.mutate()} disabled={!canCreate || create.isPending} title={canCreate ? undefined : 'Choisissez un projet : les templates d’instance sont réservés à l’administrateur.'}>
            <Plus /> Nouveau template
          </Button>
        }
      />
      <div className="grid gap-6 p-8 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Choice label="Afficher" value={scope} onChange={(v) => { void select(null); setScope(v ?? INSTANCE); }} options={[{ value: INSTANCE, label: 'Templates de l’instance' }, ...projects.map((p) => ({ value: p.id, label: p.title, hint: '+ instance' }))]} />
          <div className="flex flex-wrap gap-1.5">
            {[null, ...TEMPLATE_CATEGORIES].map((c) => (
              <button key={c ?? 'all'} type="button" onClick={() => setCategory(c)} className={cn('rounded-sm border px-2 py-1 text-sm transition-colors', category === c ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}>
                {c ? categoryLabel(c) : 'Toutes'}
              </button>
            ))}
          </div>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : visible.length === 0 ? (
            <EmptyState icon={FileText} title={templates.length ? 'Aucun template dans cette catégorie' : 'Aucun template'} description={canCreate ? 'Créez-en un : écrivez le prompt une fois, remplissez ses variables à chaque usage.' : 'L’administrateur n’a pas encore créé de template d’instance. Choisissez un projet pour y créer les vôtres.'} />
          ) : (
            <ul className="divide-y rounded-md border">
              {visible.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => select(t.id)} className={cn('w-full px-3 py-2.5 text-left transition-colors', t.id === selectedId ? 'bg-accent' : 'hover:bg-accent/50')}>
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {categoryLabel(t.category)} · {t.project ? t.project.title : 'Instance'}
                      {t.variables.length > 0 && ` · ${t.variables.length} variable${t.variables.length > 1 ? 's' : ''}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <TemplateEditor key={selected.id} t={selected} editable={canEdit(selected)} onChange={set} onDelete={() => remove.mutate(selected.id)} />
        ) : (
          <div className="hidden h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground xl:sticky xl:top-16 xl:flex">Choisissez un template pour le modifier ou le remplir.</div>
        )}
      </div>
    </div>
  );
}

function TemplateEditor({ t, editable, onChange, onDelete }: { t: Template; editable: boolean; onChange: (p: Partial<Template>) => void; onDelete: () => void }) {
  const [vars, setVars] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const filled = fillTemplate(t.body, Object.fromEntries(Object.entries(vars).filter(([, v]) => v.trim())));

  async function copy() {
    try {
      await navigator.clipboard.writeText(filled);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copie impossible : le navigateur refuse l’accès au presse-papiers.');
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <Panel
        title={editable ? 'Modifier' : 'Template de l’instance'}
        description={editable ? 'Enregistré automatiquement.' : 'Lecture seule : seul l’administrateur modifie les templates de l’instance.'}
        actions={
          editable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer « {t.name} » ?</AlertDialogTitle>
                  <AlertDialogDescription>Le template disparaît pour {t.project ? `le projet ${t.project.title}` : 'toute l’instance'}. Les prompts déjà générés avec lui ne changent pas.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <TextField label="Nom" value={t.name} onChange={(v) => v.trim() && onChange({ name: v })} disabled={!editable} />
            <Choice label="Catégorie" value={t.category} onChange={(v) => v && onChange({ category: v })} options={CATEGORY_OPTIONS} disabled={!editable} />
          </div>
          <AreaField label="Corps" hint="Écrivez les variables entre doubles accolades : {{personnage}}, {{lieu}}, {{lumiere}}." value={t.body} onChange={(v) => v.trim() && onChange({ body: v })} rows={10} mono disabled={!editable} />
          <div className="space-y-1.5">
            <Label>Variables détectées</Label>
            {t.variables.length ? (
              <div className="flex flex-wrap gap-1.5">
                {t.variables.map((v) => (
                  <span key={v} className="rounded-sm bg-secondary px-2 py-0.5 font-mono text-xs">
                    {v}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune : le template sera copié tel quel.</p>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Aperçu"
        description="Remplissez les variables pour obtenir le prompt final."
        actions={
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? 'Copié' : 'Copier'}
          </Button>
        }
      >
        <div className="space-y-4">
          {t.variables.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {t.variables.map((v) => (
                <div key={v} className="space-y-1.5">
                  <Label htmlFor={`var-${v}`} className="font-mono text-xs">
                    {v}
                  </Label>
                  <Input id={`var-${v}`} value={vars[v] ?? ''} onChange={(e) => setVars((s) => ({ ...s, [v]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
          <pre className="rounded-md border bg-muted/40 p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">{filled}</pre>
        </div>
      </Panel>
    </div>
  );
}
