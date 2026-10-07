import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { repoUrl } from '@/lib/shared';
import { ChapterHead } from './chapter';
import { CompilerDemo } from './compiler-demo';
import { CopyButton } from './copy-button';

/* ─── 03 · La bible et le compilateur ──────────────────────────────── */

export function Bible() {
  return (
    <section id="bible" className="relative scroll-mt-16 border-t border-border" aria-labelledby="bible-title">
      <div className="mx-auto max-w-[1440px] px-4 pt-28 sm:px-8 md:pt-40">
        <ChapterHead
          n="03"
          label="La bible et le compilateur"
          id="bible-title"
          lines={[
            <>
              Le prompt est <em>compilé</em>,
            </>,
            'pas écrit.',
          ]}
        />
        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <p data-reveal className="max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
              Chaque personnage a une description gelée, un costume, une silhouette, une liste d’interdits et une feuille de référence. Chaque
              lieu, sa plaque. Le style et les états de lumière s’appliquent partout.
            </p>
            <ul className="mt-10 divide-y divide-border border-y border-border">
              {[
                ['CH1 · L2 · P3', 'Des codes courts, repris tels quels dans les prompts.'],
                ['EN', 'Les champs visuels en anglais, que les modèles comprennent mieux.'],
                ['v12', 'Un historique de versions par fiche, comparable et restaurable.'],
              ].map(([k, t], i) => (
                <li key={k} data-reveal data-delay={i * 0.08} className="grid grid-cols-[7.5rem_1fr] items-baseline gap-4 py-4">
                  <span className="font-mono text-[12px] text-signal-bright">{k}</span>
                  <span className="text-[15px] text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure data-reveal className="crop">
            <span className="crop-b" aria-hidden />
            <div className="overflow-hidden rounded-[3px] ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/screens/characters.webp"
                alt="Capture de régie : la bible du projet, personnages avec leurs codes, descriptions gelées et feuilles de référence."
                width={1920}
                height={1200}
                loading="lazy"
                decoding="async"
                className="block aspect-[16/10] h-auto w-full"
              />
            </div>
          </figure>
        </div>
      </div>

      {/* Scène épinglée : la compilation, cible par cible. */}
      <div data-compile-stage className="relative lg:flex lg:min-h-screen lg:flex-col lg:justify-center">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-24 sm:px-8 lg:py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <p className="display text-[clamp(2rem,3.4vw,3.25rem)]">
              Une bible, <em className="text-signal">quatre</em> grammaires.
            </p>
            <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
              Le compilateur assemble la bible et le plan dans la grammaire de chaque moteur. Déterministe : deux compilations du même plan
              donnent le même prompt.
            </p>
          </div>
          <CompilerDemo />
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Sortie réelle de packages/core sur la bible de test du dépôt. Six cibles : still, veo, kling, wan, runway, sheet.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── 06 · Fournisseurs ────────────────────────────────────────────── */

const ADAPTERS: [string, string][] = [
  ['OpenAI', 'texte · image · vidéo · voix'],
  ['Anthropic', 'texte'],
  ['Google', 'texte · image · vidéo'],
  ['Fal', 'image · vidéo · audio'],
  ['Replicate', 'image · vidéo · audio'],
  ['Runway', 'image · vidéo'],
  ['Luma', 'image · vidéo'],
  ['ElevenLabs', 'voix · effets'],
  ['Ollama', 'texte · local'],
  ['ComfyUI', 'image · vidéo · local'],
  ['API compatible OpenAI', 'texte · image'],
  ['API personnalisée', 'tout'],
];

const COMPATIBLE = ['DeepInfra', 'Together AI', 'OpenRouter', 'Groq', 'Fireworks AI', 'Mistral AI', 'DeepSeek', 'xAI', 'Cerebras', 'Moonshot AI', 'Alibaba Cloud', 'SiliconFlow', 'LM Studio', 'vLLM', 'llama.cpp'];

function Marquee({ items, reverse = false, duration }: { items: [string, string][]; reverse?: boolean; duration: string }) {
  const row = (dup: boolean) =>
    items.map(([name, caps]) => (
      <li key={`${name}-${dup}`} data-dup={dup || undefined} aria-hidden={dup || undefined} className="flex shrink-0 items-baseline gap-4 pr-14">
        <span className="display text-[clamp(2.75rem,6.5vw,6.5rem)] leading-none">{name}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{caps}</span>
        <span className="ml-10 size-2 self-center rounded-full bg-signal" aria-hidden />
      </li>
    ));
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <ul className="marquee py-3" data-reverse={reverse || undefined} style={{ '--marquee-duration': duration } as React.CSSProperties}>
        {row(false)}
        {row(true)}
      </ul>
    </div>
  );
}

export function Providers() {
  return (
    <section id="fournisseurs" className="relative scroll-mt-16 border-t border-border py-28 md:py-40" aria-labelledby="fournisseurs-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <ChapterHead
            n="06"
            label="Fournisseurs"
            id="fournisseurs-title"
            lines={[
              <>
                Aucun fournisseur <em>câblé</em>.
              </>,
            ]}
          />
          <p data-reveal className="max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
            Douze adapters derrière une interface commune, tout service compatible OpenAI, et vos modèles locaux. Le routeur choisit selon la
            qualité, le coût ou la vitesse ; vous pouvez toujours forcer un modèle.
          </p>
        </div>
      </div>

      <div className="mt-20 space-y-2" role="region" aria-label="Fournisseurs pris en charge">
        <Marquee items={ADAPTERS.slice(0, 6)} duration="70s" />
        <Marquee items={ADAPTERS.slice(6)} duration="80s" reverse />
      </div>

      <div className="mx-auto mt-20 grid max-w-[1440px] gap-14 px-4 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div>
          <ul className="divide-y divide-border border-y border-border">
            {[
              'Clés chiffrées en base (AES-256-GCM), jamais renvoyées à l’interface.',
              'Sans modèle configuré, la demande est refusée avant d’entrer en file. Aucune génération simulée.',
              'Chaque appel facturable est tracé : coût par projet, scène, modèle.',
            ].map((t, i) => (
              <li key={t} data-reveal data-delay={i * 0.08} className="flex gap-4 py-4 text-[15px] text-muted-foreground">
                <span className="font-mono text-[11px] text-signal-bright">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
          <p data-reveal className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
            <span className="text-foreground">Et tout service qui parle le format OpenAI :</span> {COMPATIBLE.join(', ')}… Une URL, une clé
            facultative, et régie découvre les modèles disponibles.
          </p>
        </div>
        <figure data-reveal className="crop self-start">
          <span className="crop-b" aria-hidden />
          <div className="overflow-hidden rounded-[3px] ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/screens/providers.webp"
              alt="Capture de régie : les réglages des fournisseurs d’IA, chacun avec ses capacités et son état."
              width={1920}
              height={1200}
              loading="lazy"
              decoding="async"
              className="block aspect-[16/10] h-auto w-full"
            />
          </div>
        </figure>
      </div>
    </section>
  );
}

/* ─── 07 · Open source et démarrage ────────────────────────────────── */

const QUICKSTART = [
  { label: 'Récupérer le code', cmd: 'git clone https://github.com/edwinfranck/regie && cd regie' },
  { label: 'Configurer', cmd: 'cp .env.example .env', note: 'puis renseigner AUTH_SECRET et ENCRYPTION_KEY (openssl rand -base64 32)' },
  { label: 'Installer et lancer les services', cmd: 'pnpm install && pnpm services' },
  { label: 'Préparer la base et démarrer', cmd: 'pnpm db:deploy && pnpm db:seed && pnpm dev' },
];

export function OpenSource() {
  return (
    <section id="open-source" className="relative scroll-mt-16 border-t border-border pt-28 md:pt-40" aria-labelledby="open-source-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <ChapterHead
          n="07"
          label="Open source"
          id="open-source-title"
          lines={[
            <>
              Chez <em>vous</em>,
            </>,
            'de bout en bout.',
          ]}
        />

        <div className="mt-16 grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <p data-reveal className="max-w-md text-[17px] leading-relaxed text-muted-foreground text-pretty">
              régie est un logiciel libre sous licence MIT. Il s’installe sur votre machine ou votre serveur : vos scénarios, vos références et
              vos clés ne quittent pas votre infrastructure, sauf vers les fournisseurs que vous choisissez.
            </p>
            <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
              {[
                ['MIT', 'Licence libre'],
                ['Auto-hébergé', 'Web, worker, PostgreSQL, Redis, S3'],
                ['16 Go', 'Une machine suffit, Docker Compose'],
                ['Modulaire', 'Un adapter de plus, c’est un fichier'],
              ].map(([t, d]) => (
                <div key={t} data-reveal className="bg-background p-5">
                  <dt className="display text-[1.9rem] leading-none">{t}</dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{d}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div data-reveal>
            <div className="overflow-hidden rounded-[4px] border border-border-strong bg-code shadow-[var(--shadow-frame)]">
              <div className="flex h-11 items-center gap-2 border-b border-border px-4">
                <span className="size-2.5 rounded-full bg-signal" aria-hidden />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Démarrage · quatre commandes</span>
              </div>
              <ol>
                {QUICKSTART.map((q, i) => (
                  <li key={q.cmd} className="border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
                    <p className="mb-1 flex items-baseline gap-3 font-mono text-[11px] text-muted-foreground">
                      <span className="text-signal-bright">0{i + 1}</span>
                      {q.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere]">
                        <span className="select-none text-signal-bright">$ </span>
                        {q.cmd}
                      </code>
                      <CopyButton text={q.cmd} />
                    </div>
                    {q.note ? <p className="mt-1 pl-4 font-mono text-[11px] text-muted-foreground"># {q.note}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-4 text-[14px] text-muted-foreground">
              Prérequis : Node 20.11+, pnpm 10, Docker. L’application tourne sur localhost:3000 ; le premier compte créé devient administrateur.{' '}
              <Link href="/docs/demarrage-rapide" className="inline-flex min-h-11 items-center gap-1 text-foreground underline decoration-signal underline-offset-4">
                Guide d’installation
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Appel final */}
      <div className="relative mt-32 overflow-hidden border-t border-border py-28 md:mt-40 md:py-40">
        <div className="glow-signal pointer-events-none absolute inset-x-0 -bottom-1/2 top-0" aria-hidden />
        <div className="relative mx-auto max-w-[1440px] px-4 text-center sm:px-8">
          <p data-reveal className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="text-signal-bright">●</span> Moteur… ça tourne
          </p>
          <p data-lines className="display mt-8 text-[clamp(4rem,14vw,15rem)]">
            <span className="mask-line">
              <span>Faites votre</span>
            </span>
            <span className="mask-line">
              <span>
                <em className="text-signal">film</em>.
              </span>
            </span>
          </p>
          <div data-reveal className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={repoUrl}
              className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-foreground px-8 text-[16px] font-medium text-background transition-colors hover:bg-signal hover:text-foreground"
            >
              <GitHubMark className="size-5" />
              Voir sur GitHub
            </a>
            <Link
              href="/docs"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-full border border-border-strong px-8 text-[16px] font-medium transition-colors hover:border-foreground"
            >
              Lire la documentation
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
