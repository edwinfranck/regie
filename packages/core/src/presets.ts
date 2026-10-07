// Les valeurs proposées dans les listes déroulantes du développement. Ce sont
// des suggestions : chaque champ accepte aussi une saisie libre.

export interface Preset {
  value: string;
  label?: string;
  hint?: string;
}

export interface PresetGroup {
  group: string;
  items: Preset[];
}

const items = (...v: string[]): Preset[] => v.map((value) => ({ value }));

export const GENRES: { value: string; subgenres: string[] }[] = [
  { value: 'Drame', subgenres: ['Drame social', 'Drame familial', 'Drame psychologique', 'Drame historique', 'Drame romantique', 'Mélodrame', 'Coming-of-age'] },
  { value: 'Comédie', subgenres: ['Comédie romantique', 'Comédie dramatique', 'Comédie noire', 'Satire', 'Parodie', 'Burlesque', 'Comédie de mœurs'] },
  { value: 'Thriller', subgenres: ['Thriller psychologique', 'Thriller politique', 'Thriller d’espionnage', 'Thriller judiciaire', 'Huis clos'] },
  { value: 'Policier', subgenres: ['Polar', 'Film noir', 'Enquête', 'Film de casse', 'Film de gangsters'] },
  { value: 'Horreur', subgenres: ['Surnaturel', 'Horreur psychologique', 'Slasher', 'Found footage', 'Folk horror', 'Body horror'] },
  { value: 'Fantastique', subgenres: ['Réalisme magique', 'Conte', 'Fantastique urbain', 'Mythologie'] },
  { value: 'Fantasy', subgenres: ['High fantasy', 'Dark fantasy', 'Fantasy épique', 'Sword and sorcery'] },
  { value: 'Science-fiction', subgenres: ['Anticipation', 'Dystopie', 'Cyberpunk', 'Space opera', 'Post-apocalyptique', 'Uchronie', 'Afrofuturisme'] },
  { value: 'Action', subgenres: ['Arts martiaux', 'Film de guerre', 'Survival', 'Film catastrophe'] },
  { value: 'Aventure', subgenres: ['Quête', 'Film d’exploration', 'Road movie', 'Film de pirates'] },
  { value: 'Romance', subgenres: ['Romance tragique', 'Romance historique', 'Amour impossible'] },
  { value: 'Historique', subgenres: ['Biopic', 'Film d’époque', 'Péplum', 'Reconstitution'] },
  { value: 'Western', subgenres: ['Western crépusculaire', 'Western spaghetti', 'Néo-western'] },
  { value: 'Musical', subgenres: ['Comédie musicale', 'Film de danse', 'Film-concert'] },
  { value: 'Documentaire', subgenres: ['Portrait', 'Investigation', 'Nature', 'Docu-fiction', 'Essai'] },
  { value: 'Animation', subgenres: ['Anime', 'Animation 2D', 'Animation 3D', 'Stop motion', 'Animation adulte'] },
  { value: 'Expérimental', subgenres: ['Poème visuel', 'Film d’art', 'Film-essai'] },
  { value: 'Familial', subgenres: ['Jeunesse', 'Conte familial'] },
];

export const subgenresOf = (genre?: string | null) => GENRES.find((g) => g.value.toLowerCase() === (genre ?? '').toLowerCase())?.subgenres ?? GENRES.flatMap((g) => g.subgenres);

export const DURATIONS: Preset[] = [
  { value: '1', label: '1 min', hint: 'contenu social' },
  { value: '3', label: '3 min', hint: 'clip, pub longue' },
  { value: '5', label: '5 min', hint: 'très court' },
  { value: '10', label: '10 min', hint: 'court-métrage' },
  { value: '15', label: '15 min', hint: 'court-métrage' },
  { value: '26', label: '26 min', hint: 'épisode' },
  { value: '52', label: '52 min', hint: 'épisode, documentaire' },
  { value: '90', label: '90 min', hint: 'long-métrage' },
  { value: '120', label: '120 min', hint: 'long-métrage' },
];

export const COUNTRIES: PresetGroup[] = [
  { group: 'Europe', items: items('France', 'Belgique', 'Suisse', 'Royaume-Uni', 'Irlande', 'Espagne', 'Portugal', 'Italie', 'Allemagne', 'Pays-Bas', 'Suède', 'Norvège', 'Danemark', 'Pologne', 'Grèce', 'Russie') },
  { group: 'Afrique', items: items('Sénégal', 'Côte d’Ivoire', 'Mali', 'Burkina Faso', 'Cameroun', 'Guinée', 'Bénin', 'Togo', 'Niger', 'Gabon', 'Congo', 'RD Congo', 'Nigeria', 'Ghana', 'Kenya', 'Éthiopie', 'Afrique du Sud', 'Maroc', 'Algérie', 'Tunisie', 'Égypte', 'Madagascar') },
  { group: 'Amériques', items: items('États-Unis', 'Canada', 'Québec', 'Mexique', 'Cuba', 'Haïti', 'Brésil', 'Argentine', 'Chili', 'Colombie', 'Pérou', 'Antilles françaises') },
  { group: 'Asie et Moyen-Orient', items: items('Japon', 'Corée du Sud', 'Chine', 'Hong Kong', 'Taïwan', 'Inde', 'Thaïlande', 'Viêt Nam', 'Indonésie', 'Philippines', 'Iran', 'Turquie', 'Liban', 'Israël', 'Palestine') },
  { group: 'Océanie', items: items('Australie', 'Nouvelle-Zélande', 'Polynésie française', 'Nouvelle-Calédonie') },
  { group: 'Imaginaire', items: items('Monde imaginaire', 'Pays fictif', 'Planète inconnue', 'Aucun lieu précis') },
];

export const ERAS: Preset[] = [
  { value: 'Préhistoire' },
  { value: 'Antiquité' },
  { value: 'Moyen Âge' },
  { value: 'Renaissance' },
  { value: 'XVIIe – XVIIIe siècle' },
  { value: 'XIXe siècle' },
  { value: 'Belle Époque (1890–1914)' },
  { value: 'Entre-deux-guerres' },
  { value: 'Seconde Guerre mondiale' },
  { value: 'Années 1950' },
  { value: 'Années 1960' },
  { value: 'Années 1970' },
  { value: 'Années 1980' },
  { value: 'Années 1990' },
  { value: 'Années 2000' },
  { value: 'Contemporain' },
  { value: 'Futur proche' },
  { value: 'Futur lointain' },
  { value: 'Intemporel' },
];

export const AUDIENCES: Preset[] = [
  { value: 'Tout public' },
  { value: 'Enfants', hint: '3–8 ans' },
  { value: 'Famille' },
  { value: 'Pré-adolescents', hint: '9–12 ans' },
  { value: 'Adolescents', hint: '13–17 ans' },
  { value: 'Jeunes adultes', hint: '18–25 ans' },
  { value: 'Adultes' },
  { value: 'Public averti', hint: '16+' },
  { value: 'Cinéphiles, festivals' },
  { value: 'Réseaux sociaux' },
  { value: 'Professionnels, B2B' },
];

export const TONES: Preset[] = items(
  'Grave',
  'Léger',
  'Ironique',
  'Sombre',
  'Lumineux',
  'Onirique',
  'Poétique',
  'Mélancolique',
  'Tendre',
  'Angoissant',
  'Tendu',
  'Absurde',
  'Burlesque',
  'Épique',
  'Contemplatif',
  'Réaliste',
  'Satirique',
  'Nostalgique',
  'Mystérieux',
  'Violent',
  'Intime',
  'Solaire',
);

export const THEMES: Preset[] = items(
  'Amour',
  'Famille',
  'Filiation',
  'Amitié',
  'Trahison',
  'Pardon',
  'Vengeance',
  'Deuil',
  'Identité',
  'Exil',
  'Migration',
  'Liberté',
  'Pouvoir',
  'Justice',
  'Corruption',
  'Sacrifice',
  'Rédemption',
  'Transmission',
  'Tradition et modernité',
  'Croyance',
  'Culpabilité',
  'Solitude',
  'Ambition',
  'Survie',
  'Passage à l’âge adulte',
  'Mémoire',
  'Condition féminine',
  'Racisme',
  'Classes sociales',
  'Nature et écologie',
  'Technologie',
  'Folie',
  'Mort',
  'Destin',
);

export const INSPIRATIONS: PresetGroup[] = [
  { group: 'Réalisateurs', items: items('Ousmane Sembène', 'Djibril Diop Mambéty', 'Mati Diop', 'Abderrahmane Sissako', 'Agnès Varda', 'Jacques Audiard', 'Céline Sciamma', 'Wong Kar-wai', 'Hayao Miyazaki', 'Bong Joon-ho', 'Park Chan-wook', 'Akira Kurosawa', 'Stanley Kubrick', 'Denis Villeneuve', 'Christopher Nolan', 'Wes Anderson', 'David Lynch', 'Jordan Peele', 'Barry Jenkins', 'Guillermo del Toro', 'Alfonso Cuarón', 'Andreï Tarkovski') },
  { group: 'Films', items: items('Touki Bouki', 'Atlantique', 'Timbuktu', 'La Noire de…', 'In the Mood for Love', 'Le Voyage de Chihiro', 'Parasite', 'Blade Runner 2049', 'Moonlight', 'Get Out', 'Portrait de la jeune fille en feu', 'Le Labyrinthe de Pan', 'Mad Max: Fury Road', 'Spider-Man: New Generation', 'Akira', 'Arrival') },
  { group: 'Esthétiques', items: items('Réalisme magique', 'Afrofuturisme', 'Néo-noir', 'Ghibli', 'Nouvelle Vague', 'Néoréalisme', 'Esthétique A24', 'Western spaghetti', 'Cyberpunk néon', 'Photographie de Seydou Keïta', 'Peinture de Hopper') },
];

// Fiches personnage.
export const CHARACTER_ROLES: Preset[] = [
  { value: 'Protagoniste', hint: 'porte l’histoire' },
  { value: 'Antagoniste', hint: 's’oppose au protagoniste' },
  { value: 'Deutéragoniste', hint: 'second rôle principal' },
  { value: 'Mentor' },
  { value: 'Allié' },
  { value: 'Rival' },
  { value: 'Confident' },
  { value: 'Figure d’amour' },
  { value: 'Gardien du seuil' },
  { value: 'Messager' },
  { value: 'Trickster', hint: 'le farceur, l’imprévisible' },
  { value: 'Figure parentale' },
  { value: 'Victime' },
  { value: 'Narrateur' },
  { value: 'Second rôle' },
  { value: 'Figurant' },
];

export const AGE_RANGES: Preset[] = [
  { value: 'Enfant', hint: 'moins de 12 ans' },
  { value: 'Adolescent', hint: '12–17 ans' },
  { value: '18-20 ans' },
  { value: '20-30 ans' },
  { value: '30-40 ans' },
  { value: '40-60 ans' },
  { value: '60-75 ans' },
  { value: 'Senior', hint: 'plus de 75 ans' },
  { value: 'Sans âge' },
];

export const GENDERS: Preset[] = items('Femme', 'Homme', 'Non-binaire', 'Fluide', 'Non précisé', 'Autre');

// Fiches lieu : atmosphère.
export const WEATHERS: Preset[] = items(
  'Grand soleil',
  'Ciel voilé',
  'Nuageux',
  'Couvert',
  'Brume',
  'Brouillard',
  'Bruine',
  'Pluie',
  'Averse',
  'Orage',
  'Vent fort',
  'Harmattan',
  'Tempête de sable',
  'Neige',
  'Gel',
  'Canicule',
  'Humide et lourd',
  'Après la pluie',
  'Sans objet (intérieur)',
);

export const MOODS: Preset[] = items(
  'Paisible',
  'Chaleureux',
  'Familier',
  'Animé',
  'Festif',
  'Bruyant',
  'Étouffant',
  'Oppressant',
  'Inquiétant',
  'Hostile',
  'Désolé',
  'Abandonné',
  'Mystérieux',
  'Sacré',
  'Solennel',
  'Mélancolique',
  'Nostalgique',
  'Onirique',
  'Clinique',
  'Luxueux',
  'Délabré',
  'Intime',
);

export const LIGHTINGS: PresetGroup[] = [
  { group: 'Source', items: items('Lumière naturelle', 'Soleil direct', 'Lumière de fenêtre', 'Néons', 'Tungstène', 'Bougies', 'Feu', 'Écrans', 'Lampadaires', 'Phares', 'Lune') },
  { group: 'Qualité', items: items('Douce, diffuse', 'Dure, contrastée', 'Clair-obscur', 'Contre-jour', 'Faible clé (low key)', 'Haute clé (high key)', 'Silhouettes', 'Rais de lumière', 'Pénombre') },
  { group: 'Température', items: items('Chaude, dorée', 'Froide, bleutée', 'Heure dorée', 'Heure bleue', 'Mixte chaud-froid', 'Verdâtre, blafarde') },
];

export const PALETTES: PresetGroup[] = [
  { group: 'Dominantes', items: items('Ocres et terres', 'Ors et bruns', 'Bleus nuit', 'Verts profonds', 'Rouges sang', 'Pastels', 'Noir et blanc', 'Désaturée', 'Monochrome', 'Néons saturés', 'Sépia', 'Tons chair') },
  { group: 'Contrastes', items: items('Orange et bleu (teal & orange)', 'Rouge et vert', 'Complémentaires vives', 'Accent rouge sur fond neutre', 'Blanc éclatant', 'Couleurs primaires') },
];

// Scènes : fiche et mise en scène.
export const EMOTIONS: Preset[] = items(
  'Joie',
  'Allégresse',
  'Tendresse',
  'Amour',
  'Espoir',
  'Soulagement',
  'Émerveillement',
  'Nostalgie',
  'Mélancolie',
  'Tristesse',
  'Chagrin',
  'Solitude',
  'Honte',
  'Culpabilité',
  'Colère',
  'Frustration',
  'Jalousie',
  'Dégoût',
  'Peur',
  'Angoisse',
  'Tension',
  'Suspense',
  'Malaise',
  'Surprise',
  'Stupeur',
  'Fierté',
  'Détermination',
  'Sérénité',
  'Euphorie',
  'Humour',
);

export const RHYTHMS: Preset[] = [
  { value: 'Lent' },
  { value: 'Contemplatif' },
  { value: 'Posé' },
  { value: 'Soutenu' },
  { value: 'Nerveux' },
  { value: 'Haletant' },
  { value: 'Frénétique' },
  { value: 'En crescendo', hint: 'accélère jusqu’à la fin' },
  { value: 'En rupture', hint: 'change brusquement' },
  { value: 'Suspendu' },
];

export const DIRECTION_STYLES: Preset[] = items(
  'Naturaliste',
  'Réaliste',
  'Documentaire',
  'Caméra à l’épaule',
  'Plans-séquences',
  'Stylisé',
  'Symétrique',
  'Contemplatif',
  'Onirique',
  'Expressionniste',
  'Néo-noir',
  'Pop, coloré',
  'Minimaliste',
  'Théâtral',
  'Clip',
);

export const CAMERA_STYLES: Preset[] = items(
  'Caméra fixe',
  'Caméra portée',
  'Steadicam',
  'Travellings lents',
  'Plans-séquences',
  'Champ-contrechamp',
  'Longue focale',
  'Courte focale, grand angle',
  'Gros plans serrés',
  'Plans larges',
  'Plongées et contre-plongées',
  'Caméra subjective',
  'Drone',
  'Zooms',
);

export const flatPresets = (g: PresetGroup[]) => g.flatMap((x) => x.items);

/** Le texte brut d'un champ rédigé en éditeur riche (HTML), pour les modèles et les exports. */
export function toPlain(html: string | null | undefined): string {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\/\s*(p|h[1-6]|blockquote|li|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Du texte brut (proposition de l'IA, ancienne valeur) vers le HTML de l'éditeur riche. */
export function toRich(text: string | null | undefined): string {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li><p>${esc(l.replace(/^\s*[-*•]\s+/, ''))}</p></li>`).join('')}</ul>`;
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('');
}
