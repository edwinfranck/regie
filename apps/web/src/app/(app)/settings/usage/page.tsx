'use client';

import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, PageHeader, Panel } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { get } from '@/lib/client';

interface Bucket {
  key: string;
  label?: string;
  cost: number;
  count: number;
}
interface UsageData {
  days: number;
  total: number;
  thisMonth: number;
  calls: number;
  tokens: number;
  daily: Bucket[];
  byProvider: Bucket[];
  byModel: Bucket[];
  byCapability: Bucket[];
  byProject: Bucket[];
  byScene: Bucket[];
}

const CAPABILITY: Record<string, string> = { TEXT: 'Texte', IMAGE: 'Image', VIDEO: 'Vidéo', AUDIO: 'Audio', EMBEDDING: 'Embedding' };
const usd = (n: number) => (n === 0 ? '0 $' : n < 0.01 ? `${n.toFixed(4)} $` : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`);
const int = (n: number) => n.toLocaleString('fr-FR');

/** Remplit les jours sans dépense pour que l'axe du temps reste régulier. */
function fillDays(daily: Bucket[], days: number) {
  const by = new Map(daily.map((d) => [d.key, d]));
  const out: { day: string; label: string; cost: number; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), cost: by.get(key)?.cost ?? 0, count: by.get(key)?.count ?? 0 });
  }
  return out;
}

export default function UsagePage() {
  const [days, setDays] = useState('30');
  const [all, setAll] = useState(false);
  const isAdmin = useQuery({ queryKey: ['providers'], queryFn: () => get('/api/providers'), staleTime: 60_000, select: (d: any) => !!d.isAdmin }).data;
  const { data, isLoading } = useQuery<UsageData>({ queryKey: ['usage', days, all], queryFn: () => get(`/api/usage?days=${days}${all ? '&all=1' : ''}`) });

  return (
    <div>
      <PageHeader
        title="Coûts et usage"
        description="Ce que coûtent les générations, estimé d’après les prix déclarés sur chaque modèle (ou le coût renvoyé par le fournisseur quand il le donne)."
        actions={
          <>
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={all} onCheckedChange={setAll} /> Toute l’instance
              </label>
            )}
            <ToggleGroup type="single" variant="outline" value={days} onValueChange={(v) => v && setDays(v)}>
              <ToggleGroupItem value="7">7 jours</ToggleGroupItem>
              <ToggleGroupItem value="30">30 jours</ToggleGroupItem>
              <ToggleGroupItem value="90">90 jours</ToggleGroupItem>
            </ToggleGroup>
          </>
        }
      />
      <div className="space-y-6 p-8">
        {isLoading || !data ? (
          <div className="grid gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Tile label={`Total sur ${data.days} jours`} value={usd(data.total)} />
              <Tile label="Mois en cours" value={usd(data.thisMonth)} hint={data.days < 31 ? 'dans la période affichée' : undefined} />
              <Tile label="Appels" value={int(data.calls)} />
              <Tile label="Tokens" value={int(data.tokens)} hint="entrée + sortie, modèles de texte" />
            </div>

            {data.calls === 0 ? (
              <EmptyState icon={Receipt} title="Aucune dépense sur la période" description="Chaque génération (texte, image, vidéo, son) laissera ici une ligne avec son coût estimé, son provider, son modèle et son projet." />
            ) : (
              <>
                <Panel title="Coût quotidien">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fillDays(data.daily, data.days)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
                        <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} tickFormatter={(v: number) => `${v} $`} />
                        <Tooltip
                          cursor={{ fill: 'var(--accent)' }}
                          contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--popover-foreground)' }}
                          formatter={(v) => [usd(Number(v)), 'Coût']}
                          labelFormatter={(l) => String(l)}
                        />
                        <Bar dataKey="cost" fill="var(--chart-1)" radius={[2, 2, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Breakdown title="Par provider" rows={data.byProvider} />
                  <Breakdown title="Par modèle" rows={data.byModel} mono />
                  <Breakdown title="Par capacité" rows={data.byCapability.map((r) => ({ ...r, label: CAPABILITY[r.key] ?? r.key }))} />
                  <Breakdown title="Par projet" rows={data.byProject} />
                  <Breakdown title="Par scène" rows={data.byScene} empty="Aucune génération rattachée à un plan sur la période." />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Barres horizontales : la part de chaque ligne dans la plus grosse dépense. */
function Breakdown({ title, rows, mono, empty = 'Rien sur la période.' }: { title: string; rows: Bucket[]; mono?: boolean; empty?: string }) {
  const max = Math.max(...rows.map((r) => r.cost), 0);
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.slice(0, 12).map((r) => (
            <li key={r.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={mono ? 'truncate font-mono text-[13px]' : 'truncate'}>{r.label ?? r.key}</span>
                <span className="shrink-0 tabular-nums">
                  {usd(r.cost)} <span className="text-muted-foreground">· {int(r.count)} appel{r.count > 1 ? 's' : ''}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-sm bg-secondary">
                <div className="h-full rounded-sm bg-chart-1" style={{ width: `${max ? Math.max(2, (r.cost / max) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
          {rows.length > 12 && <li className="text-xs text-muted-foreground">et {rows.length - 12} autres</li>}
        </ul>
      )}
    </Panel>
  );
}
