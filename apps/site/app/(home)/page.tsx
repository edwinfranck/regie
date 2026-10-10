import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRight,
  BookMarked,
  Boxes,
  Clapperboard,
  Container,
  Download,
  FileText,
  Film,
  LayoutGrid,
  Lightbulb,
  Lock,
  Scissors,
  Server,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { CompilerDemo } from '@/components/landing/compiler-demo';
import { CopyButton } from '@/components/landing/copy-button';
import { AppWindow, Floating, Parallax, PromptCompare, ProviderLogo, StepBar } from '@/components/landing/interactive';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';
import { Screen, type ScreenName } from '@/components/landing/screen';
import { appUrl, repoUrl } from '@/lib/shared';

/* ─── Primitives ───────────────────────────────────────────────────── */

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      <div className="mx-auto max-w-[1600px] px-4 py-20 sm:px-6 md:py-28 lg:px-10">{children}</div>
    </section>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <Reveal>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-[12.5px] font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-signal" />
        {children}
      </span>
    </Reveal>
  );
}

// Titre en deux tons : première ligne atténuée, seconde pleine.
function TwoTone({ muted, strong, className = '' }: { muted: string; strong: string; className?: string }) {
  return (
    <Reveal delay={0.04}>
      <h2 className={`font-display text-[2rem] leading-[1.08] font-semibold text-balance sm:text-[2.9rem] ${className}`}>
        <span className="text-muted-foreground/60">{muted}</span>{' '}
        <span className="text-foreground">{strong}</span>
      </h2>
    </Reveal>
  );
}

function Lead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Reveal delay={0.08}>
      <p className={`mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground text-pretty ${className}`}>{children}</p>
    </Reveal>
  );
}

function Shot({ name, caption, className = '', parallax = false }: { name: ScreenName; caption: string; className?: string; parallax?: boolean }) {
  const shot = (
    <div className="transition-transform duration-500 ease-out will-change-transform hover:-translate-y-1">
      <Screen name={name} caption={caption} />
    </div>
  );
  return (
    <Reveal delay={0.06} className={className}>
      {parallax ? <Parallax amount={28}>{shot}</Parallax> : shot}
    </Reveal>
  );
}

/* ─── Données ──────────────────────────────────────────────────────── */

const STEPS: { id: string; icon: ComponentType<{ className?: string; strokeWidth?: number }>; name: string; text: string }[] = [
  { id: 'concept', icon: Lightbulb, name: 'Concept', text: 'Une idée devient logline, synopsis, thèmes, enjeux et personnages proposés.' },
  { id: 'histoire', icon: Waypoints, name: 'Histoire', text: 'Trois actes, voyage du héros, Save the Cat… temps forts reliés aux scènes.' },
  { id: 'bible', icon: BookMarked, name: 'Bible', text: 'Personnages, lieux, objets, monde, styles et lumières : la source de vérité.' },
  { id: 'scenario', icon: FileText, name: 'Scénario', text: 'Éditeur au format cinéma (Fountain), versions, assistance sur sélection.' },
  { id: 'decoupage', icon: Clapperboard, name: 'Découpage', text: 'Scènes, dépouillement, mise en scène, plans avec la bibliothèque caméra.' },
  { id: 'storyboard', icon: LayoutGrid, name: 'Storyboard', text: 'Une case par plan, ou une planche entière en une seule génération.' },
  { id: 'generation', icon: Film, name: 'Génération', text: 'Image, vidéo, audio : file de jobs, progression en direct, coût réel.' },
  { id: 'montage', icon: Scissors, name: 'Montage', text: 'Espace plein écran : pistes, chutier, coupe, fondus, assemblage auto.' },
  { id: 'export', icon: Download, name: 'Export', text: 'Scénario PDF, Final Draft, storyboard, film MP4 ou MOV, SRT, EDL.' },
];

const PRODUCT_TABS: { name: ScreenName; label: string }[] = [
  { name: 'concept', label: 'Concept' },
  { name: 'script', label: 'Scénario' },
  { name: 'scene', label: 'Découpage' },
  { name: 'characters', label: 'Bible' },
  { name: 'storyboard', label: 'Storyboard' },
  { name: 'montage', label: 'Montage' },
];

const ADAPTERS: { name: string; caps: string[] }[] = [
  { name: 'OpenAI', caps: ['texte', 'image', 'vidéo', 'voix'] },
  { name: 'Anthropic', caps: ['texte'] },
  { name: 'Google', caps: ['texte', 'image', 'vidéo'] },
  { name: 'fal', caps: ['image', 'vidéo', 'audio'] },
  { name: 'Replicate', caps: ['image', 'vidéo', 'audio'] },
  { name: 'Runway', caps: ['image', 'vidéo'] },
  { name: 'Luma', caps: ['image', 'vidéo'] },
  { name: 'ElevenLabs', caps: ['voix', 'effets'] },
  { name: 'Ollama', caps: ['texte', 'local'] },
  { name: 'ComfyUI', caps: ['image', 'vidéo', 'local'] },
  { name: 'Compatible OpenAI', caps: ['texte', 'image'] },
  { name: 'API personnalisée', caps: ['tout'] },
];

const MARQUEE: { name: string; slug?: string }[] = [
  { name: 'OpenAI', slug: 'openai' },
  { name: 'Anthropic', slug: 'anthropic' },
  { name: 'Google Gemini', slug: 'googlegemini' },
  { name: 'fal' },
  { name: 'Replicate', slug: 'replicate' },
  { name: 'Runway' },
  { name: 'Luma' },
  { name: 'ElevenLabs', slug: 'elevenlabs' },
  { name: 'Ollama', slug: 'ollama' },
  { name: 'ComfyUI' },
  { name: 'Hugging Face', slug: 'huggingface' },
  { name: 'Together' },
  { name: 'OpenRouter', slug: 'openrouter' },
  { name: 'Groq' },
  { name: 'Mistral', slug: 'mistralai' },
  { name: 'vLLM' },
];

const REFS = [
  ['Feuilles des personnages', 'face, trois-quarts, dos'],
  ['Échelle des tailles', 's’il y a plusieurs personnages'],
  ['Planche d’objets', 'à échelle commune'],
  ['Objets du plan', 'accessoires, costumes'],
  ['Plaque du lieu', 'hérité de la scène si besoin'],
  ['Style', 'le rendu actif du projet'],
];

const CONTINUITY: [string, string, string][] = [
  ['bloquant', 'Personnage ou lieu du plan sans référence', 'bg-signal text-signal-foreground'],
  ['erreur', 'Mouvement interdit, plan trop long, trop de personnages', 'border border-foreground'],
  ['avert.', 'Lumière qui contredit l’heure de la scène', 'border border-border-strong text-muted-foreground'],
  ['info', 'Personnage jamais utilisé, scène sans plan', 'text-muted-foreground'],
];

const QUICKSTART = [
  { label: 'Récupérer le code', cmd: 'git clone https://github.com/edwinfranck/regie && cd regie' },
  { label: 'Configurer', cmd: 'cp .env.example .env', note: 'puis AUTH_SECRET et ENCRYPTION_KEY (openssl rand -base64 32)' },
  { label: 'Installer et lancer les services', cmd: 'pnpm install && pnpm services' },
  { label: 'Préparer la base et démarrer', cmd: 'pnpm db:deploy && pnpm db:seed && pnpm dev' },
];

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* 2. Hero sombre */}
      <section className="panel-dark grain relative overflow-hidden">
        <div className="halo-signal pointer-events-none absolute inset-x-0 top-0 -z-0 h-[600px]" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 pt-36 pb-32 text-center sm:px-6 md:pt-44 md:pb-40">
          <RevealGroup>
            <RevealItem>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
                <span className="size-1.5 rounded-full bg-signal" />
                Open source · MIT · auto-hébergé
              </span>
            </RevealItem>
            <RevealItem>
              <h1 className="font-display mx-auto mt-6 max-w-5xl text-[clamp(1.75rem,6.5vw,4.2rem)] leading-[1.05] font-semibold text-balance">
                Une bible, un découpage,
                <br />
                <span className="text-signal">N moteurs.</span>
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground/70 text-pretty sm:text-lg">
                Le studio open source pour faire un film avec l’IA. De l’idée au montage, sans que vos personnages changent de visage d’un plan
                à l’autre.
              </p>
            </RevealItem>
            <RevealItem>
              <div className="mt-9 flex flex-row flex-wrap items-center justify-center gap-3">
                <a href={appUrl} className="group inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-foreground px-5 text-[15px] font-medium text-background transition-[transform,opacity,box-shadow] duration-200 hover:-translate-y-0.5 hover:opacity-95 hover:shadow-[0_12px_30px_-10px_oklch(0_0_0/0.5)] active:translate-y-0">
                  Essayer la démo
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a href={repoUrl} className="inline-flex h-11 items-center justify-center gap-2.5 rounded-[12px] border border-border-strong px-4 text-[15px] font-medium transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-secondary active:translate-y-0 sm:px-5">
                  <GitHubMark className="size-[18px]" />
                  GitHub
                </a>
              </div>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      {/* 3. Fenêtre produit qui chevauche le hero */}
      <section className="relative">
        <div className="panel-dark absolute inset-x-0 top-0 -z-10 h-32" aria-hidden />
        <div className="mx-auto -mt-10 max-w-[1600px] px-4 sm:px-6 lg:px-10 md:-mt-16">
          <Reveal>
            <Floating amount={8} duration={7}>
              <AppWindow tabs={PRODUCT_TABS} priority />
            </Floating>
          </Reveal>
        </div>

        {/* 4. Trois principes */}
        <div className="mx-auto mt-16 max-w-[1600px] px-4 sm:px-6 lg:px-10 max-md:pb-14">
          <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              [Sparkles, 'Aucune génération simulée', 'Sans fournisseur configuré, l’interface le dit et propose de le configurer. Rien ne fait semblant.'],
              [Boxes, 'Aucun fournisseur câblé', 'Chaque fournisseur est un adapter derrière une interface commune. On en change sans toucher au reste.'],
              [Lock, 'Contrôler avant de dépenser', 'Le contrôle de continuité tourne en permanence et bloque les plans sans référence.'],
            ].map(([Icon, t, d]) => {
              const I = Icon as ComponentType<{ className?: string; strokeWidth?: number }>;
              return (
                <RevealItem key={t as string}>
                  <div className="h-full rounded-[16px] border border-border bg-muted/40 p-6">
                    <I className="size-5 text-signal" strokeWidth={1.75} />
                    <p className="mt-4 font-medium">{t as string}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d as string}</p>
                  </div>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </div>
      </section>

      {/* 5. Le problème → la solution */}
      <Section id="probleme" className="max-md:hidden">
        <Pill>Le problème</Pill>
        <div className="mt-5">
          <TwoTone muted="Un modèle n’a aucune mémoire." strong="régie lui en donne une." />
          <Lead>
            Tout ce qui n’est ni écrit ni montré sera réinventé, différemment à chaque fois. régie écrit la bible du projet une fois, puis en
            compile chaque prompt : même code, même description gelée, même feuille de référence, pour tous les plans.
          </Lead>
        </div>
        <div className="mt-12">
          <Reveal>
            <PromptCompare />
          </Reveal>
        </div>
      </Section>

      {/* 6. Le parcours — bande sombre */}
      <section id="parcours" className="panel-dark max-md:hidden">
        <div className="mx-auto max-w-[1600px] px-4 py-20 sm:px-6 md:py-28 lg:px-10">
          <Pill>Le parcours</Pill>
          <TwoTone className="mt-5" muted="De l’idée au film," strong="dans un seul outil." />
          <Lead>Neuf étapes, chacune nourrit la suivante. On revient à n’importe laquelle : tout reste relié.</Lead>
          <div className="sticky top-20 z-10 mt-10 -mx-4 bg-background/80 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-full sm:px-3">
            <StepBar steps={STEPS.map((s) => ({ id: s.id, label: s.name }))} />
          </div>
          <RevealGroup className="mt-8 grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <RevealItem key={s.id} className="bg-background">
                <div id={s.id} className="flex h-full gap-4 scroll-mt-32 p-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border">
                    <s.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-medium">{s.name}</span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* 7. La bible et le compilateur */}
      <Section id="la-bible" className="max-md:hidden">
        <Pill>La bible et le compilateur</Pill>
        <TwoTone className="mt-5" muted="Une seule" strong="source de vérité." />
        <Lead>
          Chaque personnage a une description gelée, un costume, une silhouette, une liste d’interdits et une feuille de référence. Le
          compilateur les assemble dans la grammaire de chaque moteur, de façon déterministe.
        </Lead>
        <div className="mt-12 grid grid-cols-1 items-start gap-5 lg:grid-cols-[5fr_7fr]">
          <Reveal>
            <div className="overflow-hidden rounded-[16px] border border-border">
              <Screen name="characters" caption="Bible : personnages" />
              <div className="p-5">
                <p className="font-medium">La fiche gelée</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Des codes courts (CH1, L2, P3) repris tels quels dans les prompts, les champs visuels en anglais, un historique de versions
                  par fiche.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="rounded-[16px] border border-border p-5">
              <p className="font-medium">Le prompt est compilé, pas écrit.</p>
              <p className="mt-1 mb-4 text-sm leading-relaxed text-muted-foreground">
                Sortie réelle de <code className="font-mono text-[12.5px]">packages/core</code> sur la bible de test. Changez de moteur, le
                prompt s’adapte.
              </p>
              <CompilerDemo />
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.05} className="mt-5">
          <div className="grid grid-cols-1 items-center gap-8 rounded-[16px] border border-border p-5 lg:grid-cols-[7fr_5fr]">
            <div className="min-w-0 transition-transform duration-500 ease-out hover:-translate-y-1">
              <Screen name="prompts" caption="Prompt compilé, visible et réécrivable" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">Vous gardez la main.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Le prompt s’affiche tel qu’il partira. Une réécriture manuelle est enregistrée sur le plan, pour cette cible, et l’emporte sur
                la compilation. L’IA propose ; rien n’est écrit sans que vous l’appliquiez.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* 8. Cohérence */}
      <Section id="coherence" className="max-md:hidden">
        <Pill>Cohérence</Pill>
        <TwoTone className="mt-5" muted="Les références" strong="voyagent avec chaque plan." />
        <Lead>Générer la feuille d’un personnage en fait sa référence, chargée ensuite dans chaque plan où il apparaît.</Lead>
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="rounded-[16px] border border-border p-5">
              <p className="mb-4 text-sm font-medium">Références chargées pour un plan</p>
              <ol className="space-y-2">
                {REFS.map(([t, d], i) => (
                  <li key={t} className="flex items-center gap-4 rounded-[10px] border border-border bg-muted/40 px-4 py-3 text-sm">
                    <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-medium">{t}</span>
                    <span className="ml-auto text-right text-muted-foreground">{d}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="rounded-[16px] border border-border p-5">
              <p className="mb-4 text-sm font-medium">Contrôle de continuité, à chaque affichage</p>
              <ul className="space-y-2">
                {CONTINUITY.map(([k, t, cls]) => (
                  <li key={k} className="flex items-center gap-4 text-sm">
                    <span className={`inline-flex w-[4.5rem] shrink-0 justify-center rounded-[6px] px-1.5 py-1 font-mono text-[11px] ${cls}`}>{k}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                Gratuit et déterministe. Ce qui demande de lire le texte relève de l’analyse IA, lancée à la demande.
              </p>
            </div>
          </Reveal>
        </div>
        <div className="mt-5 grid grid-cols-1 items-center gap-8 rounded-[16px] border border-border p-5 lg:grid-cols-[5fr_7fr]">
          <div className="min-w-0">
            <p className="font-medium">Qui dépend de qui.</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Le graphe relie bible, scènes, plans, assets et générations. On sait ce qu’il faut refaire quand une fiche change.
            </p>
          </div>
          <Shot name="graph" caption="Graphe du projet" parallax className="min-w-0" />
        </div>
      </Section>

      {/* 9. Fournisseurs */}
      <Section id="fournisseurs" className="max-md:hidden">
        <Pill>Fournisseurs</Pill>
        <TwoTone className="mt-5" muted="Aucun" strong="fournisseur câblé." />
        <Lead>Douze adapters derrière une interface commune, tout service compatible OpenAI, et vos modèles locaux.</Lead>
        <div className="mt-10 -mx-4 overflow-hidden border-y border-border py-5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] sm:mx-0">
          <div className="marquee gap-12 px-4">
            {[...MARQUEE, ...MARQUEE].map((p, i) => (
              <ProviderLogo key={p.name + i} name={p.name} slug={p.slug} />
            ))}
          </div>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[7fr_5fr]">
          <RevealGroup className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-3">
            {ADAPTERS.map((a) => (
              <RevealItem key={a.name} className="bg-background">
                <div className="h-full px-4 py-3.5">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{a.caps.join(' · ')}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
          <Reveal delay={0.05}>
            <div className="h-full rounded-[16px] border border-border p-5">
              <p className="text-sm font-medium">Et tout service qui parle le format OpenAI</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                DeepInfra, Together, OpenRouter, Groq, Mistral, DeepSeek, xAI… Une URL, une clé facultative, et régie découvre les modèles.
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                {['Clés chiffrées en base, jamais renvoyées à l’interface.', 'Sans modèle, la demande est refusée avant d’entrer en file.', 'Chaque appel est tracé : coût par projet, scène, modèle.'].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-[9px] h-px w-3 shrink-0 bg-signal" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* 10. Montage et export */}
      <Section id="montage-section" className="max-md:hidden">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div className="min-w-0">
            <Pill>Montage et export</Pill>
            <TwoTone className="mt-5" muted="Le film se monte" strong="là où il a été écrit." />
            <Lead>Un espace plein écran : séquences, pistes, chutier, moniteur. L’assemblage part du découpage, un clip par plan.</Lead>
            <ul className="mt-8 space-y-4">
              {[
                ['Monter', 'Coupe, rognage, fondus, magnétisme, annuler et rétablir.'],
                ['Rendre', 'Rendu FFmpeg par le worker, en MP4 ou MOV, sous-titres incrustés.'],
                ['Exporter', 'Scénario PDF, Fountain, DOCX, Final Draft, storyboard, CSV, SRT, EDL, JSON.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-signal/15">
                    <span className="size-1.5 rounded-full bg-signal" />
                  </span>
                  <span className="text-[15px]">
                    <span className="font-medium">{t}.</span> <span className="text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative min-w-0">
            <Shot name="montage" caption="Montage" parallax />
            <Reveal delay={0.2} className="absolute -bottom-3 -left-3 hidden sm:block">
              <span className="rounded-full bg-foreground px-3 py-1.5 font-mono text-[11px] text-background shadow-lg">MP4 · MOV · SRT · EDL</span>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 11. Chez vous — bloc sombre */}
      <section id="open-source" className="panel-dark max-md:hidden">
        <div className="mx-auto max-w-[1600px] px-4 py-20 sm:px-6 md:py-24 lg:px-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center lg:gap-16">
            <div>
              <Pill>Open source</Pill>
              <TwoTone className="mt-5" muted="Chez vous," strong="de bout en bout." />
              <Lead>
                Un logiciel libre sous licence MIT. Vos scénarios, vos références et vos clés ne quittent pas votre infrastructure, sauf vers
                les fournisseurs que vous choisissez.
              </Lead>
            </div>
            <RevealGroup className="grid gap-px overflow-hidden rounded-[16px] border border-border bg-border sm:grid-cols-2">
              {[
                [Server, 'Auto-hébergé', 'Une application web et un worker, autour de PostgreSQL, Redis et un stockage S3.'],
                [Container, 'Docker Compose', 'Un fichier pour tout lancer, sur une machine de 16 Go.'],
                [Lock, 'Vos données', 'Bucket privé, URLs signées, clés chiffrées, journal d’audit.'],
                [Boxes, 'Modulaire', 'Le cœur ne dépend de rien : un adapter de plus, c’est un fichier.'],
              ].map(([Icon, t, d]) => {
                const I = Icon as ComponentType<{ className?: string; strokeWidth?: number }>;
                return (
                  <RevealItem key={t as string} className="bg-background">
                    <div className="h-full p-5">
                      <I className="size-4 text-signal" strokeWidth={1.75} />
                      <p className="mt-3 text-sm font-medium">{t as string}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d as string}</p>
                    </div>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </div>
        </div>
      </section>

      {/* 12. Démarrage rapide */}
      <Section id="demarrer" className="max-md:hidden">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div>
            <Pill>Démarrage rapide</Pill>
            <TwoTone className="mt-5" muted="Quatre" strong="commandes." />
            <Lead>Node 20.11+, pnpm 10 et Docker. L’application tourne sur localhost:3000 ; le premier compte créé devient administrateur.</Lead>
            <Link href="/docs/demarrage-rapide" className="group mt-8 inline-flex items-center gap-2 text-[15px] font-medium">
              Le guide d’installation complet
              <ArrowRight className="size-4 text-signal transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <Reveal delay={0.05}>
            <ol className="overflow-hidden rounded-[16px] border border-border bg-code">
              {QUICKSTART.map((q, i) => (
                <li key={q.cmd} className="border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
                  <p className="mb-2 flex items-baseline gap-3 text-xs text-muted-foreground">
                    <span className="font-mono text-signal">{i + 1}</span>
                    {q.label}
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="min-w-0 flex-1 font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere]">
                      <span className="select-none text-muted-foreground">$ </span>
                      {q.cmd}
                    </code>
                    <CopyButton text={q.cmd} className="-mt-1" />
                  </div>
                  {q.note ? <p className="mt-1.5 pl-4 font-mono text-[11px] text-muted-foreground"># {q.note}</p> : null}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </Section>

      {/* 13. CTA final */}
      <section className="border-t border-border bg-muted/40 max-md:hidden">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display mx-auto max-w-3xl text-[2rem] leading-[1.08] font-semibold text-balance sm:text-[2.8rem]">
              Faites votre prochain film sans que vos personnages <span className="text-signal">changent de visage.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={appUrl} className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-foreground px-6 text-[15px] font-medium text-background transition-opacity hover:opacity-90 sm:w-auto">
                Essayer la démo
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a href={repoUrl} className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-[12px] border border-border-strong px-6 text-[15px] font-medium transition-colors hover:bg-background sm:w-auto">
                <GitHubMark className="size-[18px]" />
                Voir sur GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
