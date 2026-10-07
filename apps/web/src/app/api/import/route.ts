import { importV1 } from '@regie/core';
import { importProject } from '@regie/studio';
import { api, audit, HttpError, rateLimit } from '@/lib/api';

// Import d'un dossier régie v0.1 : le navigateur envoie le dossier entier
// (bible.yaml, plans.yaml, Script.md, images de référence), chaque fichier
// nommé par son chemin relatif.
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

export const POST = api(async ({ user, req }) => {
  await rateLimit(`import:${user.id}`, 10, 3600);
  const form = await req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  const byPath = new Map(files.map((f) => [f.name.replace(/\\/g, '/'), f]));
  const find = (suffix: string) => [...byPath.keys()].find((k) => k === suffix || k.endsWith(`/${suffix}`));
  const biblePath = find('regie/bible.yaml') ?? find('bible.yaml');
  const plansPath = find('regie/plans.yaml') ?? find('plans.yaml');
  if (!biblePath || !plansPath) throw new HttpError(400, 'Le dossier doit contenir regie/bible.yaml et regie/plans.yaml.');
  // La racine du projet : le dossier qui contient regie/.
  const root = biblePath.replace(/(regie\/)?bible\.yaml$/, '');
  const scriptPath = find(`${root}Script.md`.replace(/^\//, '')) ?? find('Script.md');
  const payload = importV1(await byPath.get(biblePath)!.text(), await byPath.get(plansPath)!.text(), scriptPath ? await byPath.get(scriptPath)!.text() : undefined);
  const project = await importProject(user.id, payload, async (rel) => {
    const f = byPath.get(`${root}${rel}`.replace(/\/\.\//g, '/')) ?? byPath.get(rel);
    if (!f) return null;
    const mime = MIME[rel.split('.').pop()?.toLowerCase() ?? ''];
    if (!mime) return null;
    return { data: Buffer.from(await f.arrayBuffer()), mimeType: mime };
  });
  await audit(user.id, 'project.import', 'project', project.id);
  return { id: project.id, title: project.title, characters: payload.characters.length, locations: payload.locations.length, shots: payload.shots.length };
});
