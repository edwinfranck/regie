import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@regie/db';
import { getObject } from '@regie/storage';
import { addProvider, createGeneration, createProject, loadBible, runGeneration, StudioError } from '@regie/studio';

// Le pipeline complet, de la demande au fichier stocké : createGeneration
// (validation, routage, file BullMQ) puis runGeneration (ce que fait le
// worker). Le provider est un vrai serveur HTTP local branché par l'adapter
// « API personnalisée » : aucune génération n'est simulée dans le produit.

// PNG 1×1 valide.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let server: Server;
let url = '';
let received: any[] = [];
let userId = '';
let projectId = '';
let providerId = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push(JSON.parse(body));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ output: `data:image/png;base64,${PNG}` }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as any).port}/generate`;

  const user = await prisma.user.create({ data: { email: `it-${Date.now()}@example.com`, name: 'Intégration' } });
  userId = user.id;
  const project = await createProject(userId, { title: 'Test pipeline', kind: 'SHORT', aspectRatio: '16:9' });
  projectId = project.id;
  const provider = await addProvider({
    adapter: 'custom-http',
    name: 'Serveur de test',
    baseUrl: url,
    config: { bodyTemplate: { prompt: '{{prompt}}', ratio: '{{aspect_ratio}}' }, outputPath: 'output' },
    workspaceId: project.workspaceId,
  });
  providerId = provider.id;
  await prisma.model.create({ data: { providerId, modelId: 'test-image', label: 'Image de test', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.01 } } });
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.provider.deleteMany({ where: { id: providerId } });
  await prisma.workspace.deleteMany({ where: { members: { some: { userId } } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  server.close();
  await prisma.$disconnect();
});

describe('pipeline de génération', () => {
  it('refuse proprement une capacité sans provider configuré', async () => {
    await expect(
      createGeneration({ capability: 'VIDEO', mode: 'text-to-video', modelId: 'auto', prompt: 'x', inputAssetIds: [], inputRoles: [], links: {}, params: {} }, { userId, projectId }),
    ).rejects.toMatchObject({ code: 'provider_not_configured' });
    await expect(createGeneration({ capability: 'VIDEO', mode: 'text-to-video', modelId: 'auto', prompt: 'x', inputAssetIds: [], inputRoles: [], links: {}, params: {} }, { userId, projectId })).rejects.toBeInstanceOf(StudioError);
  });

  it('génère, stocke, rattache et facture', async () => {
    const character = await prisma.character.create({ data: { projectId, code: 'CH1', name: 'Awa', block: 'woman, 30' } });
    const gen = await createGeneration(
      {
        capability: 'IMAGE',
        mode: 'text-to-image',
        modelId: 'auto',
        prompt: 'CHARACTER SHEET of Awa',
        target: 'character:sheet',
        inputAssetIds: [],
        inputRoles: [],
        links: { characterIds: [character.id], setAsRefOf: { type: 'character', id: character.id } },
        params: {},
      },
      { userId, projectId },
    );
    expect(gen.status).toBe('QUEUED');
    expect(gen.model?.modelId).toBe('test-image');

    // Ce que fait le worker.
    await runGeneration(gen.id, { attempt: 1, maxAttempts: 3 });

    const done = await prisma.generation.findUniqueOrThrow({ where: { id: gen.id }, include: { outputs: { include: { links: true } }, usage: true } });
    expect(done.status).toBe('COMPLETED');
    expect(done.costUsd).toBe(0.01);
    expect(done.usage).toHaveLength(1);
    expect(done.outputs).toHaveLength(1);
    const asset = done.outputs[0];
    expect(asset.mimeType).toBe('image/png');
    expect(asset.width).toBe(1);
    expect(asset.links.some((l) => l.characterId === character.id)).toBe(true);
    expect((await getObject(asset.storageKey)).toString('base64')).toBe(PNG);

    // La sortie est devenue la référence du personnage, donc elle sera
    // chargée dans chaque plan où il apparaît.
    const bible = await loadBible(projectId);
    expect(bible.characters[0].refAssetId).toBe(asset.id);
    expect(received.at(-1)).toEqual({ prompt: 'CHARACTER SHEET of Awa', ratio: '16:9' });
  });

  it('enregistre un échec lisible sans retry quand le provider refuse', async () => {
    await prisma.provider.update({ where: { id: providerId }, data: { baseUrl: 'http://127.0.0.1:1/nowhere' } });
    const gen = await createGeneration({ capability: 'IMAGE', mode: 'text-to-image', modelId: 'auto', prompt: 'x', inputAssetIds: [], inputRoles: [], links: {}, params: {} }, { userId, projectId });
    await expect(runGeneration(gen.id, { attempt: 3, maxAttempts: 3 })).rejects.toMatchObject({ code: 'network' });
    const failed = await prisma.generation.findUniqueOrThrow({ where: { id: gen.id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.error).toMatch(/injoignable/);
    await prisma.provider.update({ where: { id: providerId }, data: { baseUrl: url } });
  });
});
