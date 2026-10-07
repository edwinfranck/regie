'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

// Sorties réelles de packages/core (resolveShot + compile) sur la bible de
// test du dépôt (packages/core/src/fixtures.ts), format 16:9. Rien d'inventé :
// à régénérer si le compilateur change.
const TARGETS = [
  {
    id: 'still',
    label: 'Image fixe',
    engines: 'gpt-image, Imagen, Flux…',
    text: `LOOK: flat anime cel shading, clean lines.

FORMAT: 16:9 horizontal, 1920x1080.

SHOT 1A — medium shot, waist up, camera at eye level, shot on a 35mm lens, camera locked off, completely static.

SCENE
Narrow cobbled Paris street, wet.

LIGHT
Soft overcast daylight.

CH1 — MARIE DUBOIS
Woman, 30, short black bob.
COSTUME: red raincoat

P1 black umbrella, wooden handle.

ACTION: Marie walks under the rain.`,
    negative: 'photorealistic, long hair, cars',
  },
  {
    id: 'veo',
    label: 'Cinématique',
    engines: 'Veo, Luma, Sora',
    text: `Medium shot, waist up, camera at eye level, shot on a 35mm lens, camera locked off, completely static. Marie walks under the rain. In frame: CH1 Marie, 1.65m, short black hair. Props: P1 black umbrella. A narrow Paris street. Soft daylight. Minimal motion. Mouth stays closed and neutral, no speech, no mouth movement. Rendered in flat anime cel shading. Duration 3 seconds, 16:9 horizontal.`,
    negative: 'photorealistic, long hair, cars, fast camera moves',
  },
  {
    id: 'kling',
    label: 'Concise',
    engines: 'Kling, Hailuo',
    text: `medium shot, eye level, 35mm lens, static camera. Marie walks under the rain. CH1 Marie Dubois, red raincoat. Single action only, minimal movement, camera does not move. Mouth closed, no speech.`,
    negative: 'photorealistic, long hair, cars, fast camera moves',
  },
  {
    id: 'wan',
    label: 'Technique',
    engines: 'Wan, LTX, ComfyUI',
    text: `camera: medium shot, eye level, 35mm lens, static camera
subject: CH1 Marie, 1.65m, short black hair.
action: Marie walks under the rain.
setting: a narrow Paris street
props: P1 black umbrella.
lighting: soft daylight
style: flat anime cel shading
motion: Minimal motion. Mouth stays closed and neutral, no speech, no mouth movement.
duration: 3s, 16:9`,
    negative: 'photorealistic, long hair, cars, fast camera moves',
  },
] as const;

const BIBLE: { code: string; kind: string; lines: [string, string][] }[] = [
  { code: 'S1', kind: 'Style', lines: [['block', 'LOOK: flat anime cel shading, clean lines.'], ['never', 'photorealistic']] },
  {
    code: 'CH1',
    kind: 'Personnage',
    lines: [
      ['block', 'Woman, 30, short black bob.'],
      ['costume', 'red raincoat'],
      ['never', 'long hair'],
      ['ref', 'feuille de personnage'],
    ],
  },
  { code: 'L1', kind: 'Lieu', lines: [['block', 'Narrow cobbled Paris street, wet.'], ['never', 'cars'], ['ref', 'plaque du lieu']] },
  { code: 'P1', kind: 'Objet', lines: [['block', 'P1 black umbrella, wooden handle.']] },
  { code: '1A', kind: 'Plan', lines: [['cadre', 'plan taille, 35 mm, fixe'], ['action', 'Marie walks under the rain.']] },
];

export function CompilerDemo() {
  const [active, setActive] = useState<(typeof TARGETS)[number]['id']>('still');
  const target = TARGETS.find((t) => t.id === active)!;

  return (
    <div className="grid overflow-hidden rounded-[6px] border border-border-strong/70 bg-background shadow-[var(--shadow-frame)] lg:grid-cols-[minmax(0,5fr)_auto_minmax(0,7fr)]">
      {/* La bible */}
      <div className="border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex h-10 items-center justify-between border-b border-border bg-muted/60 px-4">
          <span className="text-xs font-medium">Bible du projet</span>
          <span className="font-mono text-[11px] text-muted-foreground">entrée</span>
        </div>
        <dl className="divide-y divide-border">
          {BIBLE.map((e) => (
            <div key={e.code} className="px-4 py-3">
              <dt className="mb-1.5 flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-signal">{e.code}</span>
                <span className="text-xs text-muted-foreground">{e.kind}</span>
              </dt>
              {e.lines.map(([k, v]) => (
                <dd key={k} className="grid grid-cols-[4.5rem_1fr] gap-2 font-mono text-[12px] leading-relaxed">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="break-words">{v}</span>
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </div>

      <div className="hidden items-center justify-center bg-muted/40 px-3 lg:flex" aria-hidden>
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground [writing-mode:vertical-rl]">compile(spec, cible)</span>
          <ArrowRight className="size-4 text-signal" />
        </div>
      </div>

      {/* Le prompt compilé */}
      <div className="flex min-w-0 flex-col">
        <div className="flex h-10 items-center gap-1 overflow-x-auto border-b border-border bg-muted/60 px-2" role="tablist" aria-label="Cible de compilation">
          {TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === active}
              onClick={() => setActive(t.id)}
              className={`h-7 shrink-0 rounded-[3px] px-2.5 font-mono text-[12px] transition-colors ${
                t.id === active ? 'bg-background text-foreground shadow-[0_0_0_1px_var(--border)]' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.id}
            </button>
          ))}
        </div>
        <div className="flex items-baseline justify-between gap-4 px-4 pt-3 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{target.label}</span> · {target.engines}
          </span>
          <span className="font-mono text-[11px]">sortie</span>
        </div>
        <pre className="m-0 min-h-[18rem] flex-1 overflow-x-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12.5px] leading-relaxed">{target.text}</pre>
        <div className="border-t border-border px-4 py-3 font-mono text-[12px]">
          <span className="text-muted-foreground">negative </span>
          <span>{target.negative}</span>
        </div>
      </div>
    </div>
  );
}
