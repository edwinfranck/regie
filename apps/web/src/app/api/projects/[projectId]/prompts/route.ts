import { CHARACTER_VIEWS, LOCATION_VIEWS, activeStyle, characterPrompt, detectEntities, lineupPrompt, locationPrompt, propsSheetPrompt, resolveShot, sheet } from '@regie/core';
import { loadBible, loadScenes, loadShots } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project } from '@/lib/api';

// Les prompts qui ne partent pas d'un plan : références (feuilles, plaques,
// planches), planche storyboard multi-cases, demande libre enrichie par la bible.
const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('character'), id: z.string(), view: z.enum(Object.keys(CHARACTER_VIEWS) as [string, ...string[]]).default('sheet') }),
  z.object({ kind: z.literal('location'), id: z.string(), view: z.enum(Object.keys(LOCATION_VIEWS) as [string, ...string[]]).default('establishing') }),
  z.object({ kind: z.literal('props_sheet') }),
  z.object({ kind: z.literal('lineup') }),
  z.object({ kind: z.literal('sheet'), shotIds: z.array(z.string()).min(1).max(12), title: z.string().max(40).default('P1') }),
  z.object({ kind: z.literal('freeform'), text: z.string().min(1).max(8000) }),
]);

export const POST = api<{ projectId: string }>(async ({ params, user, req }) => {
  await project(params.projectId, user);
  const input = await body(req, schema);
  const bible = await loadBible(params.projectId);
  switch (input.kind) {
    case 'character': {
      const c = bible.characters.find((x) => x.id === input.id);
      if (!c) throw new HttpError(404, 'Personnage introuvable.');
      return characterPrompt(bible, c, input.view as any);
    }
    case 'location': {
      const l = bible.locations.find((x) => x.id === input.id);
      if (!l) throw new HttpError(404, 'Lieu introuvable.');
      return locationPrompt(bible, l, input.view as any);
    }
    case 'props_sheet':
      return propsSheetPrompt(bible);
    case 'lineup':
      return lineupPrompt(bible);
    case 'sheet': {
      const [scenes, shots] = await Promise.all([loadScenes(params.projectId), loadShots(params.projectId, { ids: input.shotIds })]);
      const specs = input.shotIds.map((id) => shots.find((s) => s.id === id)).filter(Boolean).map((s) => resolveShot(bible, s!, scenes.find((sc) => sc.id === s!.sceneId)));
      return sheet.render(specs, input.title);
    }
    case 'freeform': {
      // Sans IA : on injecte les blocs gelés des entités citées. Déterministe et gratuit.
      const hits = detectEntities(bible, input.text);
      const style = activeStyle(bible);
      const parts = [
        style.block || style.short,
        input.text,
        ...hits.locations.map((l) => `SETTING — ${l.name}\n${l.block || l.short}`),
        ...hits.characters.map((c) => `${c.code} — ${c.name.toUpperCase()}\n${c.block || c.short}${c.costume ? `\nCOSTUME: ${c.costume}` : ''}`),
        ...hits.props.map((p) => p.block || `${p.code} ${p.name}: ${p.short}`),
      ].filter(Boolean);
      const refs = [
        ...hits.characters.filter((c) => c.refAssetId).map((c) => ({ id: c.code, kind: 'character', assetId: c.refAssetId, why: `feuille ${c.name}` })),
        ...hits.locations.filter((l) => l.refAssetId).map((l) => ({ id: l.code, kind: 'location', assetId: l.refAssetId, why: `plaque ${l.name}` })),
      ];
      const never = [...new Set([...style.never, ...hits.characters.flatMap((c) => c.never), ...hits.locations.flatMap((l) => l.never)])];
      return { target: 'freeform', text: parts.join('\n\n'), negative: never, refs, notes: [`Repéré : ${[...hits.characters, ...hits.locations, ...hits.props].map((e) => e.code).join(', ') || 'aucune entité de la bible'}.`], detected: { characters: hits.characters.map((c) => c.id), locations: hits.locations.map((l) => l.id) } };
    }
  }
});
