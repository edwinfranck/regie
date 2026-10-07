import { prisma } from '@regie/db';
import { api } from '@/lib/api';

// Recherche globale (⌘K) : personnages, lieux, scènes, plans, assets,
// prompts et scénario, dans les projets accessibles.
export const GET = api(async ({ user, req }) => {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (q.length < 2) return { results: [] };
  const access = { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }, { workspace: { members: { some: { userId: user.id } } } }] };
  const inProject = projectId ? { projectId, project: access } : { project: access };
  const text = { contains: q, mode: 'insensitive' as const };
  const [projects, characters, locations, scenes, shots, assets, prompts, scripts] = await Promise.all([
    prisma.project.findMany({ where: { ...access, title: text }, take: 5, select: { id: true, title: true } }),
    prisma.character.findMany({ where: { ...inProject, OR: [{ name: text }, { code: text }, { short: text }] }, take: 8, select: { id: true, code: true, name: true, projectId: true } }),
    prisma.location.findMany({ where: { ...inProject, OR: [{ name: text }, { code: text }] }, take: 6, select: { id: true, code: true, name: true, projectId: true } }),
    prisma.scene.findMany({ where: { ...inProject, OR: [{ title: text }, { description: text }] }, take: 8, select: { id: true, number: true, title: true, projectId: true } }),
    prisma.shot.findMany({ where: { ...inProject, OR: [{ code: text }, { action: text }, { description: text }] }, take: 8, select: { id: true, code: true, action: true, projectId: true, sceneId: true } }),
    prisma.asset.findMany({ where: { ...inProject, OR: [{ name: text }, { tags: { has: q.toLowerCase() } }] }, take: 8, select: { id: true, name: true, type: true, projectId: true } }),
    prisma.generation.findMany({ where: { ...inProject, prompt: text, capability: { in: ['IMAGE', 'VIDEO'] } }, take: 5, select: { id: true, prompt: true, projectId: true, capability: true } }),
    prisma.script.findMany({ where: { ...inProject, fountain: text }, take: 5, select: { projectId: true, fountain: true } }),
  ]);
  const base = (pid: string) => `/projects/${pid}`;
  const results = [
    ...projects.map((p) => ({ type: 'project', label: p.title, href: base(p.id) })),
    ...characters.map((c) => ({ type: 'character', label: `${c.code} ${c.name}`, href: `${base(c.projectId)}/characters/${c.id}` })),
    ...locations.map((l) => ({ type: 'location', label: `${l.code} ${l.name}`, href: `${base(l.projectId)}/locations/${l.id}` })),
    ...scenes.map((s) => ({ type: 'scene', label: `Scène ${s.number}${s.title ? ` — ${s.title}` : ''}`, href: `${base(s.projectId)}/scenes/${s.id}` })),
    ...shots.map((s) => ({ type: 'shot', label: `Plan ${s.code} — ${s.action.slice(0, 60)}`, href: `${base(s.projectId)}/scenes/${s.sceneId}?shot=${s.id}` })),
    ...assets.map((a) => ({ type: 'asset', label: a.name, href: `${base(a.projectId)}/assets?asset=${a.id}` })),
    ...prompts.map((g) => ({ type: 'prompt', label: g.prompt.slice(0, 80), href: `${base(g.projectId)}/${g.capability === 'VIDEO' ? 'videos' : 'images'}?generation=${g.id}` })),
    ...scripts.flatMap((s) => {
      const line = s.fountain.split('\n').find((l) => l.toLowerCase().includes(q.toLowerCase()));
      return line ? [{ type: 'script', label: line.trim().slice(0, 90), href: `${base(s.projectId)}/script?q=${encodeURIComponent(q)}` }] : [];
    }),
  ];
  return { results };
});
