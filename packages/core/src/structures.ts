// Les structures narratives proposées au développement de l'histoire. Chaque
// temps fort devient un StoryBeat éditable, rattachable à une scène.

export interface BeatTemplate {
  key: string;
  title: string;
  hint: string;
  /** Position indicative dans le récit, de 0 à 1. */
  at: number;
}

export interface StructureTemplate {
  id: string;
  label: string;
  description: string;
  beats: BeatTemplate[];
}

const b = (key: string, title: string, at: number, hint: string): BeatTemplate => ({ key, title, at, hint });

export const STRUCTURES: StructureTemplate[] = [
  {
    id: 'THREE_ACT',
    label: 'Trois actes',
    description: 'Exposition, confrontation, résolution. La charpente par défaut.',
    beats: [
      b('setup', 'Exposition', 0, 'Le monde ordinaire, le personnage, ce qui lui manque.'),
      b('inciting', 'Incident déclencheur', 0.1, 'L’événement qui dérègle tout.'),
      b('turn1', 'Premier tournant', 0.25, 'Le personnage s’engage : pas de retour possible.'),
      b('midpoint', 'Point médian', 0.5, 'Fausse victoire ou fausse défaite ; les enjeux montent.'),
      b('low', 'Point le plus bas', 0.75, 'Tout semble perdu.'),
      b('climax', 'Climax', 0.9, 'La confrontation décisive.'),
      b('resolution', 'Résolution', 1, 'Le nouveau monde ordinaire.'),
    ],
  },
  {
    id: 'FIVE_ACT',
    label: 'Cinq actes',
    description: 'La pyramide de Freytag : exposition, montée, climax, chute, dénouement.',
    beats: [
      b('exposition', 'Exposition', 0, 'Situation initiale.'),
      b('rising', 'Action montante', 0.25, 'Complications successives.'),
      b('climax', 'Climax', 0.5, 'Le point de bascule.'),
      b('falling', 'Action descendante', 0.75, 'Les conséquences.'),
      b('denouement', 'Dénouement', 1, 'La résolution des fils.'),
    ],
  },
  {
    id: 'HEROS_JOURNEY',
    label: 'Voyage du héros',
    description: 'Les douze étapes de Vogler d’après Campbell.',
    beats: [
      b('ordinary', 'Monde ordinaire', 0, ''),
      b('call', 'Appel à l’aventure', 0.08, ''),
      b('refusal', 'Refus de l’appel', 0.12, ''),
      b('mentor', 'Rencontre du mentor', 0.18, ''),
      b('threshold', 'Passage du seuil', 0.25, ''),
      b('tests', 'Épreuves, alliés, ennemis', 0.35, ''),
      b('approach', 'Approche de la caverne', 0.45, ''),
      b('ordeal', 'L’épreuve suprême', 0.55, ''),
      b('reward', 'La récompense', 0.65, ''),
      b('road_back', 'Le chemin du retour', 0.75, ''),
      b('resurrection', 'Résurrection', 0.9, ''),
      b('return', 'Retour avec l’élixir', 1, ''),
    ],
  },
  {
    id: 'SAVE_THE_CAT',
    label: 'Save the Cat',
    description: 'Les quinze beats de Blake Snyder.',
    beats: [
      b('opening', 'Image d’ouverture', 0, ''),
      b('theme', 'Thème énoncé', 0.05, ''),
      b('setup', 'Mise en place', 0.08, ''),
      b('catalyst', 'Catalyseur', 0.1, ''),
      b('debate', 'Débat', 0.15, ''),
      b('break2', 'Entrée dans l’acte II', 0.2, ''),
      b('bstory', 'Intrigue B', 0.22, ''),
      b('fun', 'Promesse du concept', 0.3, ''),
      b('midpoint', 'Point médian', 0.5, ''),
      b('bad_guys', 'Les méchants se rapprochent', 0.6, ''),
      b('all_lost', 'Tout est perdu', 0.75, ''),
      b('dark_night', 'Nuit noire de l’âme', 0.8, ''),
      b('break3', 'Entrée dans l’acte III', 0.85, ''),
      b('finale', 'Final', 0.9, ''),
      b('final_image', 'Image finale', 1, ''),
    ],
  },
  {
    id: 'STORY_CIRCLE',
    label: 'Story Circle',
    description: 'Les huit étapes de Dan Harmon.',
    beats: [
      b('you', 'Un personnage dans sa zone de confort', 0, ''),
      b('need', 'Il veut quelque chose', 0.125, ''),
      b('go', 'Il entre dans une situation inconnue', 0.25, ''),
      b('search', 'Il s’adapte', 0.375, ''),
      b('find', 'Il obtient ce qu’il voulait', 0.5, ''),
      b('take', 'Il en paie le prix', 0.625, ''),
      b('return', 'Il revient', 0.75, ''),
      b('change', 'Il a changé', 1, ''),
    ],
  },
  {
    id: 'KISHOTENKETSU',
    label: 'Kishōtenketsu',
    description: 'Introduction, développement, retournement, conclusion — sans conflit central obligatoire.',
    beats: [
      b('ki', 'Ki — introduction', 0, ''),
      b('sho', 'Shō — développement', 0.33, ''),
      b('ten', 'Ten — retournement', 0.66, ''),
      b('ketsu', 'Ketsu — conclusion', 1, ''),
    ],
  },
  { id: 'CUSTOM', label: 'Personnalisée', description: 'Vos propres temps forts.', beats: [] },
];

export const structureById = (id: string) => STRUCTURES.find((s) => s.id === id) ?? STRUCTURES[0];
