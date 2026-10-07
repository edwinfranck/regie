import { type ImportPayload, shotCode, slugify, structureById } from '@regie/core';
import { prisma, type Prisma, type ProjectKind } from '@regie/db';
import { keyFor, putObject } from '@regie/storage';

// Création et import de projets.

/** L'espace de travail personnel, créé au premier besoin. */
export async function personalWorkspace(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({ where: { userId, role: 'OWNER' }, include: { workspace: true }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing.workspace;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return prisma.workspace.create({
    data: { name: user.name ? `Studio de ${user.name}` : 'Mon studio', slug: `${slugify(user.name || user.email.split('@')[0])}-${userId.slice(-6)}`, members: { create: { userId, role: 'OWNER' } } },
  });
}

async function uniqueSlug(workspaceId: string, title: string) {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; await prisma.project.findUnique({ where: { workspaceId_slug: { workspaceId, slug } } }); n++) slug = `${base}-${n}`;
  return slug;
}

const RESOLUTION: Record<string, string> = { '16:9': '1920x1080', '9:16': '1080x1920', '4:3': '1440x1080', '1:1': '1080x1080', '2.39:1': '2048x858', '1.85:1': '1998x1080', '4:5': '1080x1350' };

/**
 * Un projet neuf : la structure et le strict nécessaire pour compiler (deux
 * états de lumière, une structure narrative). Aucun contenu d'exemple — c'est
 * à l'auteur d'écrire le sien.
 */
export async function createProject(userId: string, input: { title: string; kind: string; aspectRatio: string; resolution?: string; language?: string; idea?: string }) {
  const ws = await personalWorkspace(userId);
  const structure = structureById('THREE_ACT');
  const vertical = input.kind === 'VERTICAL' || input.kind === 'SOCIAL';
  const aspectRatio = input.aspectRatio || (vertical ? '9:16' : '16:9');
  return prisma.project.create({
    data: {
      workspaceId: ws.id,
      ownerId: userId,
      title: input.title,
      slug: await uniqueSlug(ws.id, input.title),
      kind: input.kind as ProjectKind,
      aspectRatio,
      resolution: input.resolution || RESOLUTION[aspectRatio] || '1920x1080',
      language: input.language ?? 'fr',
      rules: { maxCharactersPerShot: 3, neverTogether: [] },
      motion: { clipSeconds: [2, 10], allowedMoves: [] },
      concept: { create: { idea: input.idea ?? '' } },
      story: { create: { structure: structure.id, beats: { create: structure.beats.map((b, i) => ({ key: b.key, title: b.title, description: '', order: i })) } } },
      world: { create: {} },
      script: { create: {} },
      lights: {
        create: [
          { code: 'DAY', name: 'Jour', short: 'natural daylight', block: '', isDefault: true },
          { code: 'NIGHT', name: 'Nuit', short: 'night, low-key lighting', block: '' },
        ],
      },
    },
  });
}

/** Renumérote les plans d'une scène : 12A, 12B… après ajout, suppression ou déplacement. */
export async function renumberShots(sceneId: string) {
  const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId }, include: { shots: { orderBy: { order: 'asc' } } } });
  // Deux passes : les codes sont uniques par projet, on libère avant de réattribuer.
  await prisma.$transaction(scene.shots.map((s, i) => prisma.shot.update({ where: { id: s.id }, data: { code: `~${s.id}`, order: i } })));
  await prisma.$transaction(scene.shots.map((s, i) => prisma.shot.update({ where: { id: s.id }, data: { code: shotCode(scene.number, i) } })));
}

export async function renumberScenes(projectId: string) {
  const scenes = await prisma.scene.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
  await prisma.$transaction(scenes.map((s, i) => prisma.scene.update({ where: { id: s.id }, data: { number: i + 1, order: i } })));
  for (const s of scenes) await renumberShots(s.id);
}

/**
 * Importe un projet régie v0.1. Les images de référence sont lues par
 * `readFile` (chemin relatif au dossier du projet) quand elles existent.
 */
export async function importProject(userId: string, payload: ImportPayload, readFile?: (path: string) => Promise<{ data: Buffer; mimeType: string } | null>) {
  const project = await createProject(userId, { title: payload.title, kind: 'SHORT', aspectRatio: payload.aspectRatio, resolution: payload.resolution });
  const pid = project.id;
  await prisma.lightState.deleteMany({ where: { projectId: pid } });

  const upload = async (path: string | null | undefined, label: string) => {
    if (!path || !readFile) return null;
    const f = await readFile(path).catch(() => null);
    if (!f) return null;
    const key = keyFor(pid, 'image', f.mimeType);
    await putObject(key, f.data, f.mimeType);
    const a = await prisma.asset.create({ data: { projectId: pid, ownerId: userId, type: 'IMAGE', source: 'IMPORTED', name: label, storageKey: key, mimeType: f.mimeType, sizeBytes: f.data.length, isReference: true } });
    return a;
  };

  const lineup = await upload(payload.assets.lineupPath, 'LINEUP');
  const propsSheet = await upload(payload.assets.propsSheetPath, 'ASSETS');
  await prisma.project.update({
    where: { id: pid },
    data: {
      rules: { ...payload.rules, lineupKey: lineup?.storageKey ?? null, propsSheetKey: propsSheet?.storageKey ?? null } as Prisma.InputJsonValue,
      motion: payload.motion as Prisma.InputJsonValue,
      script: payload.script ? { update: { fountain: payload.script } } : undefined,
    },
  });

  const ids = { character: new Map<string, string>(), location: new Map<string, string>(), prop: new Map<string, string>(), light: new Map<string, string>() };
  for (const s of payload.styles) {
    const ref = await upload(s.refPath, s.code);
    await prisma.style.create({ data: { projectId: pid, code: s.code, name: s.name, short: s.short, block: s.block, never: s.never, active: s.active, refAssetId: ref?.id } });
  }
  for (const l of payload.lights) {
    const row = await prisma.lightState.create({ data: { projectId: pid, code: l.code, name: l.name, short: l.short, block: l.block, never: l.never, isDefault: l.isDefault } });
    ids.light.set(l.code, row.id);
  }
  for (const [i, c] of payload.characters.entries()) {
    const ref = await upload(c.refPath, c.code);
    const row = await prisma.character.create({
      data: { projectId: pid, code: c.code, name: c.name, short: c.short, block: c.block, costume: c.costume, silhouette: c.silhouette, never: c.never, heightM: c.heightM, frozen: c.frozen, refAssetId: ref?.id, order: i },
    });
    if (ref) await prisma.assetLink.create({ data: { assetId: ref.id, characterId: row.id } });
    ids.character.set(c.code, row.id);
  }
  for (const [i, l] of payload.locations.entries()) {
    const ref = await upload(l.refPath, l.code);
    const row = await prisma.location.create({ data: { projectId: pid, code: l.code, name: l.name, short: l.short, block: l.block, never: l.never, sound: l.sound, refAssetId: ref?.id, order: i } });
    if (ref) await prisma.assetLink.create({ data: { assetId: ref.id, locationId: row.id } });
    ids.location.set(l.code, row.id);
  }
  for (const [i, p] of payload.props.entries()) {
    const ref = await upload(p.refPath, p.code);
    const row = await prisma.prop.create({ data: { projectId: pid, code: p.code, name: p.name, short: p.short, block: p.block, never: p.never, refAssetId: ref?.id, order: i } });
    ids.prop.set(p.code, row.id);
  }

  const sceneIds = new Map<number, string>();
  for (const s of payload.scenes) {
    const row = await prisma.scene.create({
      data: {
        projectId: pid,
        number: s.number,
        order: s.number - 1,
        title: s.locationCode ? (payload.locations.find((l) => l.code === s.locationCode)?.name ?? '') : '',
        setting: 'INT',
        locationId: s.locationCode ? ids.location.get(s.locationCode) : null,
        lightId: s.lightCode ? ids.light.get(s.lightCode) : null,
        timeOfDay: /NIGHT|NUIT/i.test(s.lightCode ?? '') ? 'NIGHT' : 'DAY',
        characters: { create: s.characterCodes.filter((c) => ids.character.has(c)).map((c) => ({ characterId: ids.character.get(c)! })) },
      },
    });
    sceneIds.set(s.number, row.id);
  }
  const shotIds = new Map<string, string>();
  for (const sh of payload.shots) {
    const row = await prisma.shot.create({
      data: {
        projectId: pid,
        sceneId: sceneIds.get(sh.sceneNumber)!,
        code: shotCode(sh.sceneNumber, sh.order),
        order: sh.order,
        action: sh.action,
        description: sh.action,
        dialogue: sh.dialogue,
        audio: sh.audio,
        size: sh.size,
        angle: sh.angle,
        lens: sh.lens,
        move: sh.move,
        durationSec: sh.durationSec,
        locationId: sh.locationCode ? ids.location.get(sh.locationCode) : null,
        lightId: sh.lightCode ? ids.light.get(sh.lightCode) : null,
        isGroup: sh.isGroup,
        note: sh.note ? `${sh.note} (plan v0.1 n°${sh.legacyId})` : `Plan v0.1 n°${sh.legacyId}`,
        characters: { create: sh.characterCodes.filter((c) => ids.character.has(c)).map((c) => ({ characterId: ids.character.get(c)! })) },
        props: { create: sh.propCodes.filter((c) => ids.prop.has(c)).map((c) => ({ propId: ids.prop.get(c)! })) },
      },
    });
    shotIds.set(sh.legacyId, row.id);
  }
  for (const sheet of payload.sheets) {
    const shots = sheet.shotLegacyIds.map((id) => shotIds.get(id)).filter(Boolean) as string[];
    await prisma.storyboard.create({ data: { projectId: pid, title: sheet.title, aspectRatio: payload.aspectRatio, frames: { create: shots.map((shotId, order) => ({ shotId, order })) } } });
  }
  return project;
}
