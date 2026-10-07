import { compileAll, lint, resolveShot, targetForAdapter, TARGETS } from '@regie/core';
import { loadShotContext } from '@regie/studio';
import { api, project } from '@/lib/api';

// Le Prompt Compiler appliqué à un plan : le contexte résolu, un prompt par
// cible, les références à charger, et les problèmes qui bloqueraient la génération.
export const GET = api<{ projectId: string; shotId: string }>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const { bible, scene, shot } = await loadShotContext(params.shotId);
  if (bible.project.id !== params.projectId) return Response.json({ error: 'Plan introuvable.' }, { status: 404 });
  const spec = resolveShot(bible, shot, scene);
  const issues = lint(bible, scene ? [scene] : [], [shot]).issues.filter((i) => i.entity?.type === 'shot');
  const adapter = req.nextUrl.searchParams.get('adapter');
  return {
    spec: { ...spec, style: { code: spec.style.code, name: spec.style.name } },
    prompts: compileAll(spec),
    targets: Object.values(TARGETS).map((t) => ({ id: t.id, label: t.label, kind: t.kind, variant: t.variant })),
    recommended: adapter ? { image: targetForAdapter(adapter, 'image').id, video: targetForAdapter(adapter, 'video').id } : null,
    issues,
  };
});
