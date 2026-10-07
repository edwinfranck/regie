'use client';

import { useQuery } from '@tanstack/react-query';
import { PlugZap } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/common/page-header';
import { AdapterCatalog } from '@/components/settings/providers/catalog';
import { LocalGuide } from '@/components/settings/providers/local-guide';
import { ProviderCard } from '@/components/settings/providers/provider-card';
import { RoutingPanel } from '@/components/settings/providers/routing';
import type { ProvidersData } from '@/components/settings/providers/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { get } from '@/lib/client';

export default function ProvidersPage() {
  const { data, error } = useQuery<ProvidersData>({ queryKey: ['providers'], queryFn: () => get('/api/providers') });

  if (!data)
    return (
      <div>
        <Header />
        <div className="space-y-4 p-8">{error ? <p className="text-destructive">{(error as Error).message}</p> : [<Skeleton key="a" className="h-32" />, <Skeleton key="b" className="h-64" />]}</div>
      </div>
    );

  const adapters = new Map(data.adapters.map((a) => [a.id, a]));
  const canRoute = data.isAdmin || data.providers.some((p) => p.canManage && p.workspaceId);
  const catalog = (
    <section key="catalog" className="space-y-3">
      <h2 className="text-lg font-semibold">Catalogue</h2>
      <LocalGuide />
      {/* Un non-admin peut brancher un provider sur son espace de travail : le serveur tranche. */}
      <AdapterCatalog adapters={data.adapters} isAdmin={data.isAdmin} canAdd />
    </section>
  );
  const routing = (
    <section key="routing" className="space-y-3">
      <h2 className="text-lg font-semibold">Routage AUTO</h2>
      <RoutingPanel data={data} canEdit={canRoute} />
    </section>
  );

  return (
    <div>
      <Header />
      <div className="space-y-10 p-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Providers branchés</h2>
          {data.providers.length === 0 ? (
            <EmptyState icon={PlugZap} title="Aucun provider branché" description="Sans provider, rien ne se génère. Choisissez-en un dans le catalogue ci-dessous : un service cloud avec sa clé API, ou Ollama / ComfyUI sur votre machine." />
          ) : (
            <div className="space-y-4">
              {data.providers.map((p) => (
                <ProviderCard key={p.id} provider={p} adapter={adapters.get(p.adapter)} />
              ))}
            </div>
          )}
        </section>
        {/* Tant que rien n'est branché, le catalogue passe avant le routage. Des clés
            stables : le catalogue se déplace sans se remonter, et le dialogue d'ajout
            en cours (qui enchaîne sur la découverte) survit au premier branchement. */}
        {data.providers.length === 0 ? [catalog, routing] : [routing, catalog]}
      </div>
    </div>
  );
}

const Header = () => <PageHeader title="Providers IA" description="Les fournisseurs qui génèrent le texte, les images, les vidéos et le son. Régie ne parle à aucune API directement : tout passe par ces branchements." />;
