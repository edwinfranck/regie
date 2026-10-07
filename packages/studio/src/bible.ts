import type { Bible, MotionRules, ProjectRules, SceneInput, ShotInput } from '@regie/core';
import { prisma } from '@regie/db';

// Charge la bible d'un projet depuis la base, sous la forme que le
// compilateur attend. C'est le premier étage du Context Builder :
// Project → World → Characters → Locations → Props → Styles → Lights.

export async function loadBible(projectId: string): Promise<Bible> {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      concept: true,
      world: true,
      styles: { include: { ref: { select: { storageKey: true } } }, orderBy: { code: 'asc' } },
      lights: { orderBy: { code: 'asc' } },
      characters: { include: { ref: { select: { storageKey: true } } }, orderBy: [{ order: 'asc' }, { code: 'asc' }] },
      locations: { include: { ref: { select: { storageKey: true } } }, orderBy: [{ order: 'asc' }, { code: 'asc' }] },
      props: { include: { ref: { select: { storageKey: true } } }, orderBy: [{ order: 'asc' }, { code: 'asc' }] },
    },
  });
  const refKey = (r: { storageKey: string } | null) => r?.storageKey ?? null;
  return {
    project: {
      id: p.id,
      title: p.title,
      aspectRatio: p.aspectRatio,
      resolution: p.resolution,
      fps: p.fps,
      language: p.language,
      rules: (p.rules ?? {}) as ProjectRules,
      motion: (p.motion ?? {}) as MotionRules,
    },
    concept: p.concept,
    world: (p.world?.sections ?? null) as Record<string, string> | null,
    styles: p.styles.map((s) => ({ ...s, refKey: refKey(s.ref) })),
    lights: p.lights,
    characters: p.characters.map((c) => ({ ...c, refKey: refKey(c.ref) })),
    locations: p.locations.map((l) => ({ ...l, refKey: refKey(l.ref) })),
    props: p.props.map((x) => ({ ...x, kind: x.kind, refKey: refKey(x.ref) })),
  };
}

export async function loadScenes(projectId: string): Promise<SceneInput[]> {
  const rows = await prisma.scene.findMany({ where: { projectId }, include: { characters: true }, orderBy: [{ order: 'asc' }, { number: 'asc' }] });
  return rows.map((s) => ({ ...s, characterIds: s.characters.map((c) => c.characterId), direction: s.direction as Record<string, unknown> }));
}

export async function loadShots(projectId: string, where: { sceneId?: string; ids?: string[] } = {}): Promise<ShotInput[]> {
  const rows = await prisma.shot.findMany({
    where: { projectId, ...(where.sceneId ? { sceneId: where.sceneId } : {}), ...(where.ids ? { id: { in: where.ids } } : {}) },
    include: { characters: true, props: true, scene: { select: { order: true } } },
    orderBy: [{ scene: { order: 'asc' } }, { order: 'asc' }],
  });
  return rows.map(shotInput);
}

export function shotInput(s: any): ShotInput {
  return {
    ...s,
    characterIds: (s.characters ?? []).map((c: any) => c.characterId),
    propIds: (s.props ?? []).map((p: any) => p.propId),
    overrides: (s.overrides ?? {}) as Record<string, string>,
  };
}

/** Tout ce qu'il faut pour compiler un plan : bible, scène, plan. */
export async function loadShotContext(shotId: string) {
  const shot = await prisma.shot.findUniqueOrThrow({ where: { id: shotId }, include: { characters: true, props: true } });
  const [bible, scenes] = await Promise.all([loadBible(shot.projectId), loadScenes(shot.projectId)]);
  return { bible, scene: scenes.find((s) => s.id === shot.sceneId) ?? null, shot: shotInput(shot) };
}
