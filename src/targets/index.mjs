import still from './still.mjs';
import sheet from './sheet.mjs';
import veo from './veo.mjs';
import kling from './kling.mjs';
import wan from './wan.mjs';

// Ajouter un moteur = ajouter un fichier ici. Rien d'autre ne bouge.
export const TARGETS = { still, sheet, veo, kling, wan };
export const videoTargets = () => Object.values(TARGETS).filter((t) => t.kind === 'video');
export const get = (id) => {
  const t = TARGETS[id];
  if (!t) throw new Error(`Cible inconnue : "${id}". Disponibles : ${Object.keys(TARGETS).join(', ')}`);
  return t;
};
