import { STAGE_LABELS, KIND_LABELS } from '@regie/core';
import { prisma } from '@regie/db';
import { Activity, Boxes, Clapperboard, Coins, HardDrive, Loader2, Plus, Star } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AssetThumb } from '@/components/common/media';
import { StatusPill } from '@/components/common/status';
import { Button } from '@/components/ui/button';
import { currentUser } from '@/lib/auth';
import { fmtBytes, fmtRelative, fmtUsd } from '@/lib/utils';
import { ImportButton } from './import-button';

export const metadata = { title: 'Tableau de bord' };

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const access = { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }, { workspace: { members: { some: { userId: user.id } } } }] };
  const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [projects, active, activity, storage, cost, templates] = await Promise.all([
    prisma.project.findMany({
      where: { ...access, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { favorites: { where: { userId: user.id } }, cover: { select: { id: true } }, concept: { select: { logline: true } }, _count: { select: { scenes: true, shots: true, characters: true, assets: true } } },
    }),
    prisma.generation.findMany({ where: { project: access, status: { in: ['QUEUED', 'PROCESSING'] } }, orderBy: { createdAt: 'desc' }, take: 8, include: { project: { select: { id: true, title: true } }, model: { select: { label: true } } } }),
    prisma.revision.findMany({ where: { project: access }, orderBy: { createdAt: 'desc' }, take: 10, include: { author: { select: { name: true } }, project: { select: { id: true, title: true } } } }),
    prisma.asset.aggregate({ where: { project: access }, _sum: { sizeBytes: true }, _count: true }),
    prisma.usage.aggregate({ where: { project: access, createdAt: { gte: month } }, _sum: { costUsd: true }, _count: true }),
    prisma.promptTemplate.count({ where: { projectId: null } }),
  ]);
  const favorites = projects.filter((p) => p.favorites.length);
  const inProduction = projects.filter((p) => p.stage === 'PRODUCTION' || p.stage === 'POST_PRODUCTION');
  if (!projects.length) redirect('/new');
  const covers = await prisma.asset.findMany({ where: { projectId: { in: projects.map((p) => p.id) }, type: 'IMAGE' }, orderBy: { createdAt: 'desc' }, distinct: ['projectId'], select: { id: true, projectId: true } });
  const coverOf = new Map(covers.map((c) => [c.projectId, c.id]));

  const ENTITY: Record<string, string> = { character: 'personnage', location: 'lieu', prop: 'objet', style: 'style', world: 'monde', script: 'scénario', scene: 'scène', shot: 'plan', concept: 'concept' };

  const ProjectCard = ({ p }: { p: (typeof projects)[number] }) => {
    const cover = p.cover?.id ?? coverOf.get(p.id);
    return (
      <Link href={`/projects/${p.id}`} className="group overflow-hidden rounded-md border bg-card transition-colors hover:border-foreground/40">
        <AssetThumb asset={cover ? { id: cover, type: 'IMAGE' } : null} ratio="16:9" className="border-b" />
        <div className="space-y-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{p.title}</span>
            {p.favorites.length > 0 && <Star className="size-3.5 shrink-0 fill-foreground" />}
          </div>
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{p.concept?.logline || `${KIND_LABELS[p.kind]} · ${p.aspectRatio}`}</p>
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span>
              {STAGE_LABELS[p.stage]} · {p._count.scenes} scènes · {p._count.shots} plans
            </span>
            <span>{fmtRelative(p.updatedAt)}</span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bonjour{user.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
          <p className="text-muted-foreground">Vos films, là où vous les avez laissés.</p>
        </div>
        <div className="flex gap-2">
          <ImportButton />
          <Button asChild size="lg">
            <Link href="/new">
              <Plus /> Nouveau film
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Clapperboard, label: 'Projets', value: projects.length, sub: `${inProduction.length} en production` },
          { icon: Boxes, label: 'Assets', value: storage._count, sub: 'images, vidéos, sons' },
          { icon: HardDrive, label: 'Stockage', value: fmtBytes(storage._sum.sizeBytes ?? 0), sub: 'utilisé' },
          { icon: Coins, label: 'Coût du mois', value: fmtUsd(cost._sum.costUsd ?? 0), sub: `${cost._count} appels · `, href: '/settings/usage' },
        ].map((s) => (
          <div key={s.label} className="rounded-md border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <s.icon className="size-4" /> {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">
              {s.sub}
              {s.href && (
                <Link href={s.href} className="underline underline-offset-2">
                  détail
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {favorites.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">Favoris</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">Projets récents</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {projects.slice(0, 12).map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-medium">
            <Loader2 className="size-4" /> Générations en cours
          </h2>
          <div className="divide-y rounded-md border">
            {active.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucune génération en file.</p>}
            {active.map((g) => (
              <Link key={g.id} href={`/projects/${g.project.id}/${g.capability === 'VIDEO' ? 'videos' : g.capability === 'AUDIO' ? 'audio' : 'images'}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-accent/50">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{g.project.title}</span> — {g.prompt.slice(0, 60)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{g.model?.label}</span>
                  <StatusPill status={g.status} progress={g.progress} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-medium">
            <Activity className="size-4" /> Dernières activités
          </h2>
          <div className="divide-y rounded-md border">
            {activity.length === 0 && <p className="p-4 text-sm text-muted-foreground">Rien pour l’instant.</p>}
            {activity.map((r) => (
              <Link key={r.id} href={`/projects/${r.project.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-accent/50">
                <span className="min-w-0 truncate">
                  {r.author?.name ?? 'Quelqu’un'} a modifié un {ENTITY[r.entityType] ?? r.entityType} de <span className="font-medium">{r.project.title}</span>
                  {r.message ? ` — ${r.message}` : ''}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtRelative(r.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <p className="text-sm text-muted-foreground">
        {templates} templates de prompts disponibles —{' '}
        <Link href="/settings/templates" className="underline underline-offset-2">
          bibliothèque
        </Link>
        .
      </p>
    </div>
  );
}
