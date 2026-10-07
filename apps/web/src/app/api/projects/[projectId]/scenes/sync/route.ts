import { characterName, parseFountain, scenesOf } from '@regie/core';
import { prisma } from '@regie/db';
import { renumberShots } from '@regie/studio';
import { api, project } from '@/lib/api';

// Du scénario vers les scènes : chaque en-tête devient (ou met à jour) une
// scène, avec son lieu et sa distribution quand ils existent dans la bible.
// Les scènes existantes gardent leurs plans ; rien n'est supprimé.
export const POST = api<{ projectId: string }>(async ({ params, user }) => {
  await project(params.projectId, user, 'project.edit');
  const pid = params.projectId;
  const [script, scenes, characters, locations, lights] = await Promise.all([
    prisma.script.findUnique({ where: { projectId: pid } }),
    prisma.scene.findMany({ where: { projectId: pid }, orderBy: { order: 'asc' } }),
    prisma.character.findMany({ where: { projectId: pid } }),
    prisma.location.findMany({ where: { projectId: pid } }),
    prisma.lightState.findMany({ where: { projectId: pid } }),
  ]);
  const parsed = scenesOf(parseFountain(script?.fountain ?? ''));
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const byName = (name: string) => characters.find((c) => norm(c.name) === name || norm(c.name.split(/\s+/)[0]) === name || c.code === name);
  const locFor = (name: string) => locations.find((l) => norm(l.name) === norm(name) || norm(name).includes(norm(l.name)));
  const lightFor = (time: string) => lights.find((l) => /NIGHT|NUIT/.test(time) ? /NIGHT|NUIT/.test(l.code) : /DAY|JOUR/.test(l.code));

  let created = 0;
  let updated = 0;
  const unknown = new Set<string>();
  for (const [i, sc] of parsed.entries()) {
    const cast = sc.characters.map((n) => byName(characterName(n))).filter(Boolean).map((c) => c!.id);
    sc.characters.filter((n) => !byName(characterName(n))).forEach((n) => unknown.add(n));
    const loc = locFor(sc.parsed.location);
    const text = sc.elements.map((e) => e.text).join('\n');
    const data = {
      title: sc.parsed.location,
      setting: sc.parsed.setting,
      timeOfDay: sc.parsed.timeOfDay,
      description: text.slice(0, 20000),
      locationId: loc?.id ?? null,
      lightId: lightFor(sc.parsed.timeOfDay)?.id ?? null,
      estSeconds: Math.round((sc.words / 160) * 60) || null,
    };
    const existing = scenes[i];
    if (existing) {
      await prisma.scene.update({ where: { id: existing.id }, data: { ...data, number: i + 1, order: i, characters: { deleteMany: {}, create: cast.map((characterId) => ({ characterId })) } } });
      if (existing.number !== i + 1) await renumberShots(existing.id);
      updated++;
    } else {
      await prisma.scene.create({ data: { ...data, projectId: pid, number: i + 1, order: i, characters: { create: cast.map((characterId) => ({ characterId })) } } });
      created++;
    }
  }
  return { created, updated, total: parsed.length, extra: Math.max(0, scenes.length - parsed.length), unknownCharacters: [...unknown] };
});
