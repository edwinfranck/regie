import { breakdownScene, continuityAI, directScene, draftBeats, draftCharacter, draftConcept, draftLocation, draftShots, enrichPrompt, SCRIPT_ACTIONS, scriptAssist, scriptCoherence } from '@regie/studio';
import { z } from 'zod';
import { api, body, HttpError, project, rateLimit } from '@/lib/api';

// Les tâches d'écriture assistées. Chacune renvoie une PROPOSITION : rien
// n'est écrit en base ici, l'interface montre, l'auteur choisit.
const model = { modelId: z.string().optional() };
const TASKS = {
  concept: { action: 'project.edit', schema: z.object({ ...model, brief: z.record(z.string(), z.unknown()) }), run: (c: any, b: any) => draftConcept(c, b.brief) },
  character: { action: 'project.edit', schema: z.object({ ...model, name: z.string().min(1).max(160), notes: z.string().max(4000).optional() }), run: (c: any, b: any) => draftCharacter(c, b) },
  location: { action: 'project.edit', schema: z.object({ ...model, name: z.string().min(1).max(160), notes: z.string().max(4000).optional() }), run: (c: any, b: any) => draftLocation(c, b) },
  beats: { action: 'project.edit', schema: z.object({ ...model, structure: z.string().max(40) }), run: (c: any, b: any) => draftBeats(c, b.structure) },
  script: {
    action: 'script.edit',
    schema: z.object({ ...model, action: z.enum(Object.keys(SCRIPT_ACTIONS) as [keyof typeof SCRIPT_ACTIONS]), selection: z.string().max(20000), before: z.string().max(20000).optional(), after: z.string().max(10000).optional(), tone: z.string().max(200).optional() }),
    run: (c: any, b: any) => scriptAssist(c, b),
  },
  coherence: { action: 'project.read', schema: z.object({ ...model, fountain: z.string().max(400000) }), run: (c: any, b: any) => scriptCoherence(c, b.fountain) },
  breakdown: { action: 'project.edit', schema: z.object({ ...model, heading: z.string().max(400), text: z.string().max(40000) }), run: (c: any, b: any) => breakdownScene(c, b) },
  shots: { action: 'project.edit', schema: z.object({ ...model, sceneId: z.string(), count: z.number().int().min(1).max(40).optional(), intention: z.string().max(2000).optional() }), run: (c: any, b: any) => draftShots(c, b.sceneId, b) },
  direction: { action: 'project.edit', schema: z.object({ ...model, sceneId: z.string(), input: z.record(z.string(), z.string().max(2000)) }), run: (c: any, b: any) => directScene(c, b.sceneId, b.input) },
  continuity: { action: 'project.read', schema: z.object(model), run: (c: any) => continuityAI(c) },
  enrich: { action: 'project.read', schema: z.object({ ...model, text: z.string().min(1).max(8000), kind: z.enum(['image', 'video', 'audio']) }), run: (c: any, b: any) => enrichPrompt(c, b) },
} as const;

export const POST = api<{ projectId: string; task: string }>(async ({ params, user, req }) => {
  const task = TASKS[params.task as keyof typeof TASKS];
  if (!task) throw new HttpError(404, `Tâche inconnue : ${params.task}.`);
  await project(params.projectId, user, task.action as any);
  await rateLimit(`ai:${user.id}`, 30, 60);
  const input = await body(req, task.schema as z.ZodType<any>);
  return task.run({ projectId: params.projectId, userId: user.id, modelId: input.modelId }, input);
});
