// La grammaire camera. Un seul vocabulaire pour tout le projet :
// la fiche de plan, les prompts image et les prompts video parlent la meme langue.

export const SIZES = {
  EWS:    { fr: 'plan tres large',        en: 'extreme wide shot',            kw: 'extreme wide shot' },
  WS:     { fr: 'plan large',             en: 'wide shot',                    kw: 'wide shot' },
  MLS:    { fr: 'plan moyen large',       en: 'medium long shot, knees up',   kw: 'medium long shot' },
  MS:     { fr: 'plan moyen',             en: 'medium shot, waist up',        kw: 'medium shot' },
  MCU:    { fr: 'plan rapproche',         en: 'medium close-up, chest up',    kw: 'medium close-up' },
  CU:     { fr: 'gros plan',              en: 'close-up on the face',         kw: 'close-up' },
  ECU:    { fr: 'tres gros plan',         en: 'extreme close-up',             kw: 'extreme close-up' },
  INSERT: { fr: 'insert',                 en: 'tight insert shot on the detail', kw: 'insert shot' },
};

export const ANGLES = {
  EYE:      { fr: 'hauteur d’oeil', en: 'camera at eye level',                         kw: 'eye level' },
  LOW:      { fr: 'contre-plongee',      en: 'low angle looking up',                        kw: 'low angle' },
  HIGH:     { fr: 'plongee',             en: 'high angle looking down',                     kw: 'high angle' },
  OVERHEAD: { fr: 'plongee verticale',   en: 'overhead top-down view looking straight down', kw: 'overhead top-down' },
  OTS:      { fr: 'par-dessus l’epaule', en: 'over-the-shoulder framing',              kw: 'over the shoulder' },
  DUTCH:    { fr: 'cadre incline',       en: 'tilted dutch angle',                          kw: 'dutch angle' },
  GROUND:   { fr: 'au ras du sol',       en: 'camera at ground level',                      kw: 'ground level' },
};

export const MOVES = {
  STATIC:        { fr: 'camera fixe',        en: 'camera locked off, completely static',      kw: 'static camera' },
  PUSH_IN_SLOW:  { fr: 'leger travelling avant', en: 'very slow push in',                     kw: 'slow push in' },
  PULL_OUT_SLOW: { fr: 'leger travelling arriere', en: 'very slow pull back',                 kw: 'slow pull back' },
  PAN:           { fr: 'panoramique',        en: 'camera pans across',                        kw: 'pan' },
  TILT:          { fr: 'panoramique vertical', en: 'camera tilts',                            kw: 'tilt' },
  TRACK:         { fr: 'travelling lateral', en: 'camera tracks alongside',                   kw: 'tracking shot' },
  HANDHELD:      { fr: 'camera portee',      en: 'handheld camera',                           kw: 'handheld' },
};

export function lookup(table, key, kind) {
  const hit = table[key];
  if (!hit) throw new Error(`${kind} inconnu : "${key}". Valeurs possibles : ${Object.keys(table).join(', ')}`);
  return hit;
}

// Phrase camera complete, pour les cibles en prose.
export function cameraProse(cam) {
  const bits = [];
  if (cam.size)  bits.push(lookup(SIZES, cam.size, 'Taille de plan').en);
  if (cam.angle) bits.push(lookup(ANGLES, cam.angle, 'Angle').en);
  if (cam.lens)  bits.push(`shot on a ${cam.lens} lens`);
  if (cam.move)  bits.push(lookup(MOVES, cam.move, 'Mouvement').en);
  return bits.join(', ');
}

// Liste de mots-cles, pour les cibles structurees.
export function cameraKeywords(cam) {
  const bits = [];
  if (cam.size)  bits.push(lookup(SIZES, cam.size, 'Taille de plan').kw);
  if (cam.angle) bits.push(lookup(ANGLES, cam.angle, 'Angle').kw);
  if (cam.lens)  bits.push(`${cam.lens} lens`);
  if (cam.move)  bits.push(lookup(MOVES, cam.move, 'Mouvement').kw);
  return bits;
}

// Rappel lisible en francais, pour la fiche de plan.
export function cameraFr(cam) {
  const bits = [];
  if (cam.size)  bits.push(lookup(SIZES, cam.size, 'Taille de plan').fr);
  if (cam.angle) bits.push(lookup(ANGLES, cam.angle, 'Angle').fr);
  if (cam.lens)  bits.push(cam.lens);
  if (cam.move)  bits.push(lookup(MOVES, cam.move, 'Mouvement').fr);
  return bits.join(' · ');
}
