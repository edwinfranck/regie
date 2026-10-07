import { lint } from '@regie/core';
import { loadBible, loadScenes, loadShots } from '@regie/studio';
import { api, project } from '@/lib/api';

// Le contrôle déterministe : bible, découpage, continuité. Gratuit et
// instantané, il tourne à chaque affichage.
export const GET = api<{ projectId: string }>(async ({ params, user }) => {
  await project(params.projectId, user);
  const [bible, scenes, shots] = await Promise.all([loadBible(params.projectId), loadScenes(params.projectId), loadShots(params.projectId)]);
  return lint(bible, scenes, shots);
});
