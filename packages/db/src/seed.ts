import 'dotenv/config';
import { config as load } from 'dotenv';
import path from 'node:path';

load({ path: path.resolve(import.meta.dirname, '../../../.env') });

// Le seed ne crée aucun contenu de film : seulement les providers dont une
// clé est fournie par les variables SEED_*, et les templates de prompts de base.
const { prisma } = await import('./index');
const { addProvider } = await import('@regie/studio');

const SEEDS: [string, string, 'key' | 'url'][] = [
  ['openai', 'SEED_OPENAI_API_KEY', 'key'],
  ['anthropic', 'SEED_ANTHROPIC_API_KEY', 'key'],
  ['google', 'SEED_GOOGLE_API_KEY', 'key'],
  ['fal', 'SEED_FAL_KEY', 'key'],
  ['replicate', 'SEED_REPLICATE_API_TOKEN', 'key'],
  ['runway', 'SEED_RUNWAY_API_KEY', 'key'],
  ['luma', 'SEED_LUMA_API_KEY', 'key'],
  ['elevenlabs', 'SEED_ELEVENLABS_API_KEY', 'key'],
  ['ollama', 'SEED_OLLAMA_URL', 'url'],
  ['comfyui', 'SEED_COMFYUI_URL', 'url'],
];

for (const [adapter, env, kind] of SEEDS) {
  const v = process.env[env];
  if (!v) continue;
  if (await prisma.provider.findFirst({ where: { adapter, workspaceId: null } })) {
    console.log(`= ${adapter} déjà présent`);
    continue;
  }
  await addProvider({ adapter, ...(kind === 'key' ? { apiKey: v } : { baseUrl: v }) });
  console.log(`+ provider ${adapter}`);
}

const TEMPLATES = [
  { category: 'IMAGE', name: 'Plan cinéma', body: '{{style}}\n\n{{camera}}. {{subject}} {{action}}. Setting: {{environment}}. Lighting: {{lighting}}. Mood: {{mood}}.' },
  { category: 'CHARACTER', name: 'Feuille de personnage', body: 'CHARACTER SHEET — plain light grey background. Front, three-quarter and back views of {{name}}, full body. {{block}} COSTUME: {{costume}}' },
  { category: 'LOCATION', name: 'Plaque de décor', body: 'LOCATION PLATE — empty set, wide lens, eye level, no people. {{block}} Lighting: {{lighting}}.' },
  { category: 'VIDEO', name: 'Mouvement simple', body: '{{camera_move}}. {{subject}} {{action}}. Single action only. {{mood}}.' },
  { category: 'LIGHTING', name: 'Heure dorée', body: 'Low warm golden-hour sun from camera left, long soft shadows, gentle haze, warm highlights and cool shadows.' },
  { category: 'CAMERA', name: 'Travelling d’accompagnement', body: 'Camera tracks alongside {{subject}} at walking pace, steady, eye level, 35mm lens.' },
  { category: 'DIALOGUE', name: 'Réplique chuchotée', body: '{{character}} whispers "{{line}}", lips moving subtly, eyes on {{target}}.' },
  { category: 'SOUND', name: 'Ambiance', body: 'Ambient sound of {{place}}: {{elements}}. No music.' },
];
if (!(await prisma.promptTemplate.count({ where: { projectId: null } }))) {
  const vars = (b: string) => [...new Set([...b.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
  await prisma.promptTemplate.createMany({ data: TEMPLATES.map((t) => ({ ...t, variables: vars(t.body) })) });
  console.log(`+ ${TEMPLATES.length} templates`);
}
await prisma.$disconnect();
