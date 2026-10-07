// Le scénario au format Fountain (fountain.io) : du texte brut, lisible sans
// outil, diffable, et que Final Draft, Highland ou WriterSolo importent.
// L'éditeur travaille en éléments typés ; la base stocke du Fountain.

export type ElementType = 'scene_heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition' | 'centered' | 'note' | 'page_break';

export interface ScriptElement {
  type: ElementType;
  text: string;
}

export const ELEMENT_LABELS: Record<ElementType, string> = {
  scene_heading: 'En-tête de scène',
  action: 'Action',
  character: 'Personnage',
  parenthetical: 'Didascalie',
  dialogue: 'Dialogue',
  transition: 'Transition',
  centered: 'Centré',
  note: 'Note',
  page_break: 'Saut de page',
};

const HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[. ]/i;
const TRANSITION = /^[A-Z0-9 ]+ TO:$|^(FADE OUT\.|FADE IN:|CUT TO BLACK\.|FONDU AU NOIR\.?|COUPE FRANCHE\.?)$/;

const isUpper = (s: string) => s === s.toUpperCase() && /[A-ZÀ-Ý]/.test(s);

export function parseFountain(src: string): ScriptElement[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: ScriptElement[] = [];
  let inDialogue = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const prevBlank = i === 0 || lines[i - 1].trim() === '';
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === '';

    if (!line) {
      inDialogue = false;
      continue;
    }
    if (/^={3,}$/.test(line)) {
      out.push({ type: 'page_break', text: '' });
      continue;
    }
    if (line.startsWith('[[') && line.endsWith(']]')) {
      out.push({ type: 'note', text: line.slice(2, -2).trim() });
      continue;
    }
    if (inDialogue) {
      if (line.startsWith('(') && line.endsWith(')')) out.push({ type: 'parenthetical', text: line });
      else out.push({ type: 'dialogue', text: line });
      continue;
    }
    // Forçages explicites de la syntaxe Fountain.
    if (line.startsWith('.') && !line.startsWith('..')) {
      out.push({ type: 'scene_heading', text: line.slice(1).trim() });
      continue;
    }
    if (line.startsWith('>') && line.endsWith('<')) {
      out.push({ type: 'centered', text: line.slice(1, -1).trim() });
      continue;
    }
    if (line.startsWith('>')) {
      out.push({ type: 'transition', text: line.slice(1).trim() });
      continue;
    }
    if (line.startsWith('!')) {
      out.push({ type: 'action', text: line.slice(1) });
      continue;
    }
    if (line.startsWith('@')) {
      out.push({ type: 'character', text: line.slice(1).trim() });
      inDialogue = true;
      continue;
    }
    if (prevBlank && HEADING.test(line)) {
      out.push({ type: 'scene_heading', text: line.replace(/\s+#.*#$/, '') });
      continue;
    }
    if (prevBlank && nextBlank && TRANSITION.test(line)) {
      out.push({ type: 'transition', text: line });
      continue;
    }
    // Un nom en majuscules suivi d'une ligne non vide ouvre un dialogue.
    const name = line.replace(/\s*\(.*\)$/, '').replace(/\^$/, '');
    if (prevBlank && !nextBlank && isUpper(name) && name.length < 40 && !/[.!?:]$/.test(name)) {
      out.push({ type: 'character', text: line });
      inDialogue = true;
      continue;
    }
    // Les lignes d'action consécutives restent un seul paragraphe.
    const last = out[out.length - 1];
    if (last?.type === 'action' && !prevBlank) last.text += `\n${raw}`;
    else out.push({ type: 'action', text: raw.replace(/^\s+/, '') });
  }
  return out;
}

export function toFountain(elements: ScriptElement[]): string {
  const parts: string[] = [];
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i];
    const t = e.text.trim();
    switch (e.type) {
      case 'scene_heading':
        parts.push(`\n${HEADING.test(t) ? t.toUpperCase() : `.${t.toUpperCase()}`}\n`);
        break;
      case 'character':
        parts.push(`\n${isUpper(t) ? t : `@${t}`}`);
        break;
      case 'parenthetical':
        parts.push(t.startsWith('(') ? t : `(${t})`);
        break;
      case 'dialogue':
        parts.push(t);
        break;
      case 'transition':
        parts.push(`\n${TRANSITION.test(t.toUpperCase()) ? t.toUpperCase() : `> ${t.toUpperCase()}`}\n`);
        break;
      case 'centered':
        parts.push(`\n> ${t} <\n`);
        break;
      case 'note':
        parts.push(`\n[[${t}]]\n`);
        break;
      case 'page_break':
        parts.push('\n===\n');
        break;
      default:
        parts.push(`\n${needsBang(t) ? `!${t}` : t}\n`);
    }
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// Une ligne d'action qui ressemble à autre chose doit être forcée.
const needsBang = (t: string) => HEADING.test(t) || (isUpper(t) && t.length < 40 && !/[.!?]$/.test(t));

export interface ParsedHeading {
  setting: 'INT' | 'EXT' | 'INT_EXT';
  location: string;
  timeOfDay: string;
}

export function parseHeading(text: string): ParsedHeading {
  const m = text.trim().match(/^(INT\.?\/EXT|I\/E|INT|EXT|EST)\.?\s+(.*)$/i);
  const prefix = (m?.[1] ?? 'INT').toUpperCase();
  const rest = (m?.[2] ?? text).trim();
  const [location, ...time] = rest.split(/\s+[-–—]\s+/);
  return {
    setting: prefix.includes('/') ? 'INT_EXT' : prefix.startsWith('EXT') || prefix === 'EST' ? 'EXT' : 'INT',
    location: location.trim(),
    timeOfDay: (time.join(' - ').trim() || 'DAY').toUpperCase(),
  };
}

export function formatHeading(setting: string, location: string, timeOfDay: string) {
  const p = setting === 'INT_EXT' ? 'INT./EXT.' : `${setting}.`;
  return `${p} ${location.toUpperCase()} - ${timeOfDay.toUpperCase()}`;
}

export interface ScriptScene {
  number: number;
  heading: string;
  parsed: ParsedHeading;
  characters: string[];
  elements: ScriptElement[];
  words: number;
}

/** Découpe le scénario en scènes : la base du dépouillement. */
export function scenesOf(elements: ScriptElement[]): ScriptScene[] {
  const scenes: ScriptScene[] = [];
  let cur: ScriptScene | null = null;
  for (const e of elements) {
    if (e.type === 'scene_heading') {
      cur = { number: scenes.length + 1, heading: e.text, parsed: parseHeading(e.text), characters: [], elements: [], words: 0 };
      scenes.push(cur);
      continue;
    }
    if (!cur) continue;
    cur.elements.push(e);
    cur.words += e.text.split(/\s+/).filter(Boolean).length;
    if (e.type === 'character') {
      const name = characterName(e.text);
      if (!cur.characters.includes(name)) cur.characters.push(name);
    }
  }
  return scenes;
}

export const characterName = (text: string) => text.replace(/\s*\(.*\)$/, '').replace(/\^$/, '').trim().toUpperCase();

// Une page de scénario au format standard ≈ 55 lignes ≈ une minute d'écran.
const LINES_PER_PAGE = 55;
const WIDTH: Record<ElementType, number> = {
  scene_heading: 61,
  action: 61,
  character: 38,
  parenthetical: 25,
  dialogue: 35,
  transition: 61,
  centered: 61,
  note: 0,
  page_break: 0,
};

export function scriptStats(elements: ScriptElement[]) {
  let lines = 0;
  let words = 0;
  const speakers = new Map<string, number>();
  let current = '';
  for (const e of elements) {
    if (e.type === 'note' || e.type === 'page_break') continue;
    const w = e.text.split(/\s+/).filter(Boolean).length;
    words += w;
    const width = WIDTH[e.type] || 61;
    lines += Math.max(1, Math.ceil(e.text.length / width)) + (e.type === 'scene_heading' || e.type === 'action' || e.type === 'transition' ? 1 : 0);
    if (e.type === 'character') {
      current = characterName(e.text);
      lines += 1;
    }
    if (e.type === 'dialogue') speakers.set(current, (speakers.get(current) ?? 0) + w);
  }
  const pages = lines / LINES_PER_PAGE;
  return {
    words,
    pages: Math.round(pages * 10) / 10,
    estMinutes: Math.round(pages * 10) / 10,
    scenes: elements.filter((e) => e.type === 'scene_heading').length,
    dialogueBySpeaker: Object.fromEntries([...speakers.entries()].sort((a, b) => b[1] - a[1])),
  };
}
