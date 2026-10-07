import { toPlain } from './presets';

// Les sections de la World Bible. Toutes optionnelles : un court réaliste
// contemporain n'en remplira que deux, une saga de fantasy toutes.
export const WORLD_SECTIONS = {
  rules: { label: 'Règles du monde', hint: 'Ce qui est possible et impossible ici. Les lois que l’histoire ne transgresse pas.' },
  geography: { label: 'Géographie', hint: 'Territoires, climat, distances.' },
  history: { label: 'Histoire', hint: 'Les événements passés qui pèsent sur le présent.' },
  culture: { label: 'Culture', hint: 'Coutumes, langues, fêtes, tabous.' },
  politics: { label: 'Politique', hint: 'Qui gouverne, qui s’oppose.' },
  technology: { label: 'Technologie', hint: 'Niveau technique, objets du quotidien.' },
  religion: { label: 'Croyances', hint: 'Religions, superstitions, rites.' },
  economy: { label: 'Économie', hint: 'Monnaie, métiers, richesse et pauvreté.' },
  architecture: { label: 'Architecture', hint: 'Matériaux, formes, densité.' },
  costumes: { label: 'Costumes', hint: 'Silhouettes, tissus, couleurs par classe ou par groupe.' },
  vehicles: { label: 'Véhicules', hint: 'Comment on se déplace.' },
  objects: { label: 'Objets', hint: 'Les objets signature de ce monde.' },
} as const;

export type WorldSection = keyof typeof WORLD_SECTIONS;

/** Le monde résumé pour le contexte d'un modèle de texte. */
export function worldDigest(sections: Record<string, string> | null | undefined, max = 2400) {
  if (!sections) return '';
  const lines = Object.entries(WORLD_SECTIONS)
    .map(([k, v]) => (toPlain(sections[k]) ? `${v.label.toUpperCase()}: ${toPlain(sections[k])}` : ''))
    .filter(Boolean);
  const text = lines.join('\n');
  return text.length > max ? text.slice(0, max) + '…' : text;
}
