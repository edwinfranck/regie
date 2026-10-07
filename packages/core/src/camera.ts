// La grammaire caméra. Un seul vocabulaire pour tout le projet : la fiche de
// plan, le storyboard, les prompts image et les prompts vidéo parlent la même
// langue. `fr` s'affiche, `en` part dans les prompts en prose, `kw` dans les
// prompts à mots-clés.

export interface CameraTerm {
  fr: string;
  en: string;
  kw: string;
  hint?: string;
}

export const SIZES = {
  EWS: { fr: 'Plan très large', en: 'extreme wide shot', kw: 'extreme wide shot', hint: 'Le décor écrase le sujet.' },
  WS: { fr: 'Plan large', en: 'wide shot', kw: 'wide shot', hint: 'Le sujet en entier dans son décor.' },
  FS: { fr: 'Plan en pied', en: 'full shot, head to toe', kw: 'full shot' },
  MLS: { fr: 'Plan américain', en: 'medium long shot, knees up', kw: 'medium long shot' },
  MS: { fr: 'Plan moyen', en: 'medium shot, waist up', kw: 'medium shot' },
  MCU: { fr: 'Plan rapproché', en: 'medium close-up, chest up', kw: 'medium close-up' },
  CU: { fr: 'Gros plan', en: 'close-up on the face', kw: 'close-up' },
  ECU: { fr: 'Très gros plan', en: 'extreme close-up', kw: 'extreme close-up' },
  OTS: { fr: 'Par-dessus l’épaule', en: 'over-the-shoulder shot', kw: 'over the shoulder' },
  POV: { fr: 'Plan subjectif', en: 'point-of-view shot', kw: 'POV shot' },
  TWO: { fr: 'Plan à deux', en: 'two shot, both characters in frame', kw: 'two shot' },
  INSERT: { fr: 'Insert', en: 'tight insert shot on the detail', kw: 'insert shot' },
  ESTABLISHING: { fr: 'Plan d’ensemble', en: 'establishing shot of the location', kw: 'establishing shot' },
} satisfies Record<string, CameraTerm>;

export const ANGLES = {
  EYE: { fr: 'Hauteur d’œil', en: 'camera at eye level', kw: 'eye level' },
  LOW: { fr: 'Contre-plongée', en: 'low angle looking up', kw: 'low angle' },
  HIGH: { fr: 'Plongée', en: 'high angle looking down', kw: 'high angle' },
  OVERHEAD: { fr: 'Plongée verticale', en: 'overhead top-down view looking straight down', kw: 'overhead top-down' },
  DUTCH: { fr: 'Cadre incliné', en: 'tilted dutch angle', kw: 'dutch angle' },
  GROUND: { fr: 'Au ras du sol', en: 'camera at ground level', kw: 'ground level' },
  AERIAL: { fr: 'Vue aérienne', en: 'aerial drone view', kw: 'aerial shot' },
} satisfies Record<string, CameraTerm>;

export const MOVES = {
  STATIC: { fr: 'Caméra fixe', en: 'camera locked off, completely static', kw: 'static camera' },
  PAN: { fr: 'Panoramique', en: 'camera pans horizontally', kw: 'pan' },
  TILT: { fr: 'Panoramique vertical', en: 'camera tilts vertically', kw: 'tilt' },
  PUSH_IN: { fr: 'Travelling avant lent', en: 'slow push in toward the subject', kw: 'slow push in' },
  PULL_OUT: { fr: 'Travelling arrière lent', en: 'slow pull back from the subject', kw: 'slow pull back' },
  DOLLY: { fr: 'Travelling sur rail', en: 'smooth dolly move', kw: 'dolly shot' },
  TRUCK: { fr: 'Travelling latéral', en: 'camera trucks sideways', kw: 'truck' },
  TRACKING: { fr: 'Travelling d’accompagnement', en: 'camera tracks alongside the subject', kw: 'tracking shot' },
  CRANE: { fr: 'Grue', en: 'crane move rising above the scene', kw: 'crane shot' },
  ORBIT: { fr: 'Orbite', en: 'camera orbits around the subject', kw: 'orbit shot' },
  HANDHELD: { fr: 'Caméra portée', en: 'handheld camera, slight natural shake', kw: 'handheld' },
  STEADICAM: { fr: 'Steadicam', en: 'floating steadicam move', kw: 'steadicam' },
  ZOOM: { fr: 'Zoom', en: 'slow optical zoom', kw: 'zoom' },
} satisfies Record<string, CameraTerm>;

export const LENSES = ['14mm', '18mm', '24mm', '28mm', '35mm', '50mm', '85mm', '100mm macro', '135mm', '200mm'] as const;

export const TRANSITIONS = {
  CUT: 'Cut',
  MATCH_CUT: 'Raccord',
  DISSOLVE: 'Fondu enchaîné',
  FADE_IN: 'Ouverture au noir',
  FADE_OUT: 'Fermeture au noir',
  WHIP: 'Filé',
  SMASH: 'Smash cut',
  J_CUT: 'J-cut (son en avance)',
  L_CUT: 'L-cut (son en retard)',
} as const;

export const ASPECT_RATIOS = ['16:9', '9:16', '4:3', '1:1', '2.39:1', '1.85:1', '4:5'] as const;

export type SizeKey = keyof typeof SIZES;
export type AngleKey = keyof typeof ANGLES;
export type MoveKey = keyof typeof MOVES;

export const CAMERA_LIBRARY = { sizes: SIZES, angles: ANGLES, moves: MOVES, lenses: LENSES, transitions: TRANSITIONS };

export interface Camera {
  size?: string | null;
  angle?: string | null;
  lens?: string | null;
  move?: string | null;
}

function term(table: Record<string, CameraTerm>, key: string, kind: string): CameraTerm {
  const hit = table[key];
  if (!hit) throw new Error(`${kind} inconnu : "${key}". Valeurs possibles : ${Object.keys(table).join(', ')}`);
  return hit;
}

function parts(cam: Camera, pick: (t: CameraTerm) => string, lens: (l: string) => string) {
  const bits: string[] = [];
  if (cam.size) bits.push(pick(term(SIZES, cam.size, 'Taille de plan')));
  if (cam.angle) bits.push(pick(term(ANGLES, cam.angle, 'Angle')));
  if (cam.lens) bits.push(lens(cam.lens));
  if (cam.move) bits.push(pick(term(MOVES, cam.move, 'Mouvement')));
  return bits;
}

// Phrase caméra complète, pour les cibles en prose.
export const cameraProse = (cam: Camera) => parts(cam, (t) => t.en, (l) => `shot on a ${l} lens`).join(', ');
// Liste de mots-clés, pour les cibles structurées.
export const cameraKeywords = (cam: Camera) => parts(cam, (t) => t.kw, (l) => `${l} lens`);
// Rappel lisible en français, pour la fiche de plan.
export const cameraFr = (cam: Camera) => parts(cam, (t) => t.fr, (l) => l).join(' · ');

export const isKnown = {
  size: (k: string) => k in SIZES,
  angle: (k: string) => k in ANGLES,
  move: (k: string) => k in MOVES,
};
