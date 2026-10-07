import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookMarked,
  Clapperboard,
  Download,
  FileText,
  Film,
  Boxes,
  Container,
  LayoutGrid,
  Lightbulb,
  Lock,
  Scissors,
  Server,
  Waypoints,
} from 'lucide-react';
import { GitHubMark } from '@/components/github-mark';
import { CompilerDemo } from '@/components/landing/compiler-demo';
import { CopyButton } from '@/components/landing/copy-button';
import { Screen } from '@/components/landing/screen';
import { repoUrl } from '@/lib/shared';

/* ─── Éléments communs ─────────────────────────────────────────────── */

function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 border-t border-border ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">{children}</div>
    </section>
  );
}

function Eyebrow({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p className="mb-5 flex items-center gap-3 font-mono text-xs text-muted-foreground">
      <span className="text-signal">{n}</span>
      <span className="h-px w-6 bg-border-strong" />
      {children}
    </p>
  );
}

function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`max-w-3xl text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-balance sm:text-4xl ${className}`}>{children}</h2>;
}

function Lead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground text-pretty ${className}`}>{children}</p>;
}

/* ─── Données ──────────────────────────────────────────────────────── */

const STEPS = [
  { icon: Lightbulb, name: 'Concept', text: 'Une idée devient logline, synopsis, thèmes, enjeux et personnages proposés.' },
  { icon: Waypoints, name: 'Histoire', text: 'Trois actes, voyage du héros, Save the Cat… temps forts reliés aux scènes.' },
  { icon: BookMarked, name: 'Bible', text: 'Personnages, lieux, objets, monde, styles et lumières : la source de vérité.' },
  { icon: FileText, name: 'Scénario', text: 'Éditeur au format cinéma (Fountain), versions, assistance sur sélection.' },
  { icon: Clapperboard, name: 'Découpage', text: 'Scènes, dépouillement, mise en scène, plans avec la bibliothèque caméra.' },
  { icon: LayoutGrid, name: 'Storyboard', text: 'Une case par plan, ou une planche entière en une seule génération.' },
  { icon: Film, name: 'Génération', text: 'Image, vidéo, audio : file de jobs, progression en direct, coût réel.' },
  { icon: Scissors, name: 'Montage', text: 'Espace plein écran : pistes, chutier, coupe, fondus, assemblage auto.' },
  { icon: Download, name: 'Export', text: 'Scénario PDF, Final Draft, storyboard, film MP4 ou MOV, SRT, EDL.' },
];

const ADAPTERS: { id: string; name: string; caps: string[] }[] = [
  { id: 'openai', name: 'OpenAI', caps: ['texte', 'image', 'vidéo', 'voix'] },
  { id: 'anthropic', name: 'Anthropic', caps: ['texte'] },
  { id: 'google', name: 'Google', caps: ['texte', 'image', 'vidéo'] },
  { id: 'fal', name: 'fal', caps: ['image', 'vidéo', 'audio'] },
  { id: 'replicate', name: 'Replicate', caps: ['image', 'vidéo', 'audio'] },
  { id: 'runway', name: 'Runway', caps: ['image', 'vidéo'] },
  { id: 'luma', name: 'Luma', caps: ['image', 'vidéo'] },
  { id: 'elevenlabs', name: 'ElevenLabs', caps: ['voix', 'effets'] },
  { id: 'ollama', name: 'Ollama', caps: ['texte', 'local'] },
  { id: 'comfyui', name: 'ComfyUI', caps: ['image', 'vidéo', 'local'] },
  { id: 'openai-compatible', name: 'Compatible OpenAI', caps: ['texte', 'image'] },
  { id: 'custom-http', name: 'API personnalisée', caps: ['tout'] },
];

const COMPATIBLE = [
  'DeepInfra',
  'Together AI',
  'OpenRouter',
  'Groq',
  'Fireworks AI',
  'Mistral AI',
  'DeepSeek',
  'xAI',
  'Cerebras',
  'Moonshot AI',
  'Alibaba Cloud',
  'SiliconFlow',
  'LM Studio',
  'vLLM',
  'llama.cpp',
];

const QUICKSTART = [
  { label: 'Récupérer le code', cmd: 'git clone https://github.com/edwinfranck/regie && cd regie' },
  { label: 'Configurer', cmd: 'cp .env.example .env', note: 'puis renseigner AUTH_SECRET et ENCRYPTION_KEY (openssl rand -base64 32)' },
  { label: 'Installer et lancer les services', cmd: 'pnpm install && pnpm services' },
  { label: 'Préparer la base et démarrer', cmd: 'pnpm db:deploy && pnpm db:seed && pnpm dev' },
];

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* Héros */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 md:pt-24">
          <p className="mb-7 inline-flex items-center gap-2 rounded-[3px] border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-signal" />
            Open source · MIT · auto-hébergé
          </p>
          <h1 className="max-w-5xl text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-balance sm:text-6xl md:text-[76px]">
            Une bible, un découpage,<br className="hidden sm:block" /> <span className="text-signal">N</span> moteurs.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
            Un studio de production audiovisuelle assisté par IA. De l’idée au film, sans que les personnages changent de visage d’un plan à
            l’autre.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href={repoUrl}
              className="inline-flex h-11 items-center justify-center gap-2.5 rounded-[3px] bg-foreground px-5 text-[15px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <GitHubMark className="size-[18px]" />
              Voir sur GitHub
            </a>
            <Link
              href="/docs"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-[3px] border border-border-strong px-5 text-[15px] font-medium transition-colors hover:bg-secondary"
            >
              Lire la documentation
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-6xl px-4 sm:px-6 md:mt-20">
          <Screen name="hero" caption="Le projet : bible, scènes, plans et générations" priority />
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <dl className="grid gap-px overflow-hidden border-x border-b border-border bg-border sm:grid-cols-3">
            {[
              ['Aucune génération simulée', 'Sans fournisseur configuré, l’interface le dit et propose de le configurer. Rien ne fait semblant.'],
              ['Aucun fournisseur câblé', 'Chaque fournisseur est un adapter derrière une interface commune. On en change sans toucher au reste.'],
              ['Contrôler avant de dépenser', 'Le contrôle de continuité tourne en permanence et bloque les plans sans référence.'],
            ].map(([t, d]) => (
              <div key={t} className="bg-background p-6">
                <dt className="text-[15px] font-medium">{t}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Le problème */}
      <Section className="mt-16 md:mt-24">
        <Eyebrow n="01">Le problème</Eyebrow>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Title>Un modèle n’a aucune mémoire entre deux générations.</Title>
            <Lead>
              Tout ce qui n’est ni écrit ni montré en image sera réinventé, différemment à chaque fois. Vingt plans générés isolément, ce sont
              vingt visages, vingt manteaux, vingt rues.
            </Lead>
            <Lead>
              régie part de là : une seule source de vérité, la bible du projet, et chaque prompt en est compilé, jamais écrit à la main. Les
              références de chaque personnage et de chaque lieu sont jointes à chaque plan, automatiquement.
            </Lead>
          </div>
          <div className="space-y-5">
            <DriftRow
              label="Prompt écrit à la main, plan par plan"
              cells={['woman, long brown hair', 'young woman in a coat', 'girl, blonde, umbrella', 'woman, red jacket']}
            />
            <DriftRow
              label="Prompt compilé depuis la bible"
              stable
              cells={['CH1 · short black bob', 'CH1 · short black bob', 'CH1 · short black bob', 'CH1 · short black bob']}
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Même personnage, même costume, même lieu : la description gelée et la feuille de référence partent avec chaque plan.
            </p>
          </div>
        </div>
      </Section>

      {/* Le parcours */}
      <Section id="parcours">
        <Eyebrow n="02">Le parcours</Eyebrow>
        <Title>De l’idée au film, dans un seul outil.</Title>
        <Lead>Chaque étape nourrit la suivante. On peut revenir à n’importe laquelle : tout reste relié.</Lead>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-[6px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.name} className="flex gap-4 bg-background p-5">
              <div className="flex flex-col items-center">
                <span className="flex size-9 items-center justify-center rounded-[4px] border border-border">
                  <s.icon className="size-4" strokeWidth={1.75} />
                </span>
              </div>
              <div className="min-w-0">
                <p className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-medium">{s.name}</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-x-8 gap-y-12 md:grid-cols-2">
          <Figure title="Concept" text="Décrivez votre idée : l’assistant propose logline, synopsis, pitch et personnages. Vous gardez ce qui vous convient, champ par champ.">
            <Screen name="concept" caption="Concept" />
          </Figure>
          <Figure title="Scénario" text="Éditeur au format cinéma, statistiques, versions, export PDF, Fountain, DOCX et Final Draft.">
            <Screen name="script" caption="Scénario" />
          </Figure>
          <Figure title="Scènes et découpage" text="Dépouillement, mise en scène, puis découpage en plans avec un vocabulaire caméra que le compilateur comprend.">
            <Screen name="scene" caption="Scène et découpage" />
          </Figure>
          <Figure title="Storyboard" text="Une case par plan, dans l’ordre du film ; ou une planche entière dessinée en une passe, avec les mêmes personnages.">
            <Screen name="storyboard" caption="Storyboard" />
          </Figure>
        </div>
      </Section>

      {/* La bible et le compilateur */}
      <Section id="bible">
        <Eyebrow n="03">La bible et le compilateur</Eyebrow>
        <div className="grid items-start gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div>
            <Title>Une seule source de vérité.</Title>
            <Lead>
              Chaque personnage a une description gelée, un costume, une silhouette, une liste d’interdits et une feuille de référence. Chaque
              lieu, sa plaque. Le style et les états de lumière s’appliquent partout.
            </Lead>
            <ul className="mt-8 space-y-3 text-[15px]">
              {[
                'Des codes courts (CH1, L2, P3) repris tels quels dans les prompts.',
                'Les champs visuels en anglais, que les modèles comprennent mieux.',
                'Un historique de versions pour chaque fiche, comparable et restaurable.',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-[9px] h-px w-3 shrink-0 bg-signal" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <Screen name="characters" caption="Bible : personnages" />
        </div>

        <div className="mt-20">
          <h3 className="text-xl font-semibold tracking-tight">Le prompt est compilé, pas écrit.</h3>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Le compilateur assemble la bible et le plan dans la grammaire de chaque moteur. Il est déterministe : deux compilations du même
            plan donnent le même prompt. Le texte final reste visible et réécrivable, par cible.
          </p>
          <div className="mt-8">
            <CompilerDemo />
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Sortie réelle de packages/core sur la bible de test du dépôt. Six cibles : still, veo, kling, wan, runway, sheet.
          </p>
        </div>

        <div className="mt-20 grid items-center gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <Screen name="prompts" caption="Prompt compilé, visible et réécrivable" />
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Vous gardez la main.</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Avant chaque génération, le prompt s’affiche tel qu’il partira. Une réécriture manuelle est enregistrée sur le plan, pour cette
              cible, et l’emporte sur la compilation. L’IA propose ; rien n’est écrit en base sans que vous l’appliquiez.
            </p>
          </div>
        </div>
      </Section>

      {/* Cohérence */}
      <Section id="coherence">
        <Eyebrow n="04">Cohérence</Eyebrow>
        <Title>Les références voyagent avec chaque plan.</Title>
        <Lead>
          Générer la feuille d’un personnage en fait sa référence. Elle est ensuite chargée automatiquement dans chaque plan où il apparaît,
          dans l’ordre où un moteur à références multiples les pondère.
        </Lead>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <div className="rounded-[6px] border border-border">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Références chargées pour un plan</div>
            <ol className="divide-y divide-border">
              {[
                ['Feuilles des personnages', 'face, trois-quarts, dos'],
                ['Échelle des tailles', 's’il y a plusieurs personnages'],
                ['Planche d’objets', 'à échelle commune'],
                ['Objets du plan', 'accessoires, costumes'],
                ['Plaque du lieu', 'hérité de la scène si besoin'],
                ['Style', 'le rendu actif du projet'],
              ].map(([t, d], i) => (
                <li key={t} className="flex items-baseline gap-4 px-5 py-3 text-sm">
                  <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <span className="font-medium">{t}</span>
                  <span className="ml-auto text-right text-muted-foreground">{d}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-[6px] border border-border">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Contrôle de continuité, à chaque affichage</div>
            <ul className="divide-y divide-border">
              {[
                ['bloquant', 'Personnage ou lieu du plan sans référence', 'bg-signal text-signal-foreground'],
                ['erreur', 'Mouvement interdit, plan trop long, trop de personnages', 'border border-foreground'],
                ['avert.', 'Lumière qui contredit l’heure de la scène', 'border border-border-strong text-muted-foreground'],
                ['info', 'Personnage jamais utilisé, scène sans plan', 'text-muted-foreground'],
              ].map(([k, t, cls]) => (
                <li key={k} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className={`inline-flex w-[4.5rem] shrink-0 justify-center rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] ${cls}`}>{k}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-5 py-3 text-sm leading-relaxed text-muted-foreground">
              Gratuit et déterministe. Ce qui demande de lire le texte (une blessure qui disparaît, un costume décrit autrement) relève de
              l’analyse IA, lancée à la demande.
            </p>
          </div>
        </div>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Qui dépend de qui.</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Le graphe du projet relie bible, scènes, plans, assets et générations. Chaque fichier produit est rattaché aux personnages, lieux
              et plans qu’il montre : on sait ce qu’il faut refaire quand une fiche change.
            </p>
          </div>
          <Screen name="graph" caption="Graphe du projet" />
        </div>
      </Section>

      {/* Fournisseurs */}
      <Section id="fournisseurs">
        <Eyebrow n="05">Fournisseurs</Eyebrow>
        <div className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div>
            <Title>Aucun fournisseur câblé.</Title>
            <Lead>
              Douze adapters derrière une interface commune, tout service compatible OpenAI, et vos modèles locaux. Le routeur choisit selon la
              qualité, le coût ou la vitesse ; vous pouvez toujours forcer un modèle.
            </Lead>
            <ul className="mt-8 space-y-3 text-[15px]">
              {[
                'Clés chiffrées en base (AES-256-GCM), jamais renvoyées à l’interface.',
                'Sans modèle configuré, la demande est refusée avant d’entrer en file.',
                'Chaque appel facturable est tracé : coût par projet, scène, modèle.',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-[9px] h-px w-3 shrink-0 bg-signal" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-border bg-border sm:grid-cols-3">
              {ADAPTERS.map((a) => (
                <li key={a.id} className="bg-background px-4 py-3.5">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{a.caps.join(' · ')}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-[6px] border border-border p-5">
              <p className="text-sm font-medium">Et tout service qui parle le format OpenAI</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {COMPATIBLE.join(', ')}… Une URL, une clé facultative, et régie découvre les modèles disponibles.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-16">
          <Screen name="providers" caption="Réglages : providers IA" />
        </div>
      </Section>

      {/* Montage et export */}
      <Section id="montage">
        <Eyebrow n="06">Montage et export</Eyebrow>
        <Title>Le film se monte là où il a été écrit.</Title>
        <Lead>
          Un espace plein écran, séparé du reste : séquences, pistes vidéo, audio et sous-titres, chutier, moniteur, inspecteur. L’assemblage part
          du découpage, un clip par plan.
        </Lead>
        <div className="mt-12">
          <Screen name="montage" caption="Montage" />
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[6px] border border-border bg-border md:grid-cols-3">
          {[
            ['Monter', 'Coupe, rognage, scission, fondus, magnétisme, annuler et rétablir, raccourcis J K L.'],
            ['Rendre', 'Rendu FFmpeg par le worker, en MP4 ou MOV, sous-titres incrustés au besoin.'],
            ['Exporter', 'Scénario PDF, Fountain, DOCX, Final Draft ; storyboard PDF ; plans en CSV ; SRT et EDL ; projet en JSON.'],
          ].map(([t, d]) => (
            <div key={t} className="bg-background p-6">
              <p className="font-medium">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Open source */}
      <Section id="open-source">
        <Eyebrow n="07">Open source</Eyebrow>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Title>Chez vous, de bout en bout.</Title>
            <Lead>
              régie est un logiciel libre sous licence MIT. Il s’installe sur votre machine ou votre serveur : vos scénarios, vos références et
              vos clés ne quittent pas votre infrastructure, sauf vers les fournisseurs que vous choisissez.
            </Lead>
          </div>
          <ul className="grid gap-px self-start overflow-hidden rounded-[6px] border border-border bg-border sm:grid-cols-2">
            {[
              [Server, 'Auto-hébergé', 'Une application web et un worker, autour de PostgreSQL, Redis et un stockage S3.'],
              [Container, 'Docker Compose', 'Un fichier pour tout lancer, application comprise, sur une machine de 16 Go.'],
              [Lock, 'Vos données', 'Bucket privé, URLs signées, clés chiffrées, journal d’audit.'],
              [Boxes, 'Modulaire', 'Le cœur ne dépend de rien : un adapter de plus, c’est un fichier.'],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof Server;
              return (
                <li key={t as string} className="bg-background p-5">
                  <I className="size-4" strokeWidth={1.75} />
                  <p className="mt-3 text-sm font-medium">{t as string}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d as string}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* Démarrage rapide */}
      <Section id="demarrer">
        <Eyebrow n="08">Démarrage rapide</Eyebrow>
        <div className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-16">
          <div>
            <Title>Quatre commandes.</Title>
            <Lead>Prérequis : Node 20.11+, pnpm 10 et Docker. L’application tourne ensuite sur localhost:3000 ; le premier compte créé devient administrateur.</Lead>
            <Link href="/docs/demarrage-rapide" className="group mt-8 inline-flex items-center gap-2 text-[15px] font-medium">
              Le guide d’installation complet
              <ArrowRight className="size-4 text-signal transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <ol className="overflow-hidden rounded-[6px] border border-border bg-code">
            {QUICKSTART.map((q, i) => (
              <li key={q.cmd} className="border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
                <p className="mb-2 flex items-baseline gap-3 text-xs text-muted-foreground">
                  <span className="font-mono text-signal">{i + 1}</span>
                  {q.label}
                </p>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 font-mono [overflow-wrap:anywhere] text-[13px] leading-relaxed">
                    <span className="select-none text-muted-foreground">$ </span>
                    {q.cmd}
                  </code>
                  <CopyButton text={q.cmd} className="-mt-1" />
                </div>
                {q.note ? <p className="mt-1.5 pl-4 font-mono text-[11px] text-muted-foreground"># {q.note}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Appel final */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">Écrivez la bible une fois.</p>
            <p className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-signal sm:text-4xl">Tournez avec tous les moteurs.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={repoUrl}
              className="inline-flex h-11 items-center justify-center gap-2.5 rounded-[3px] bg-background px-5 text-[15px] font-medium text-foreground transition-opacity hover:opacity-90"
            >
              <GitHubMark className="size-[18px]" />
              Voir sur GitHub
            </a>
            <Link
              href="/docs"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[3px] border border-background/30 px-5 text-[15px] font-medium transition-colors hover:bg-background/10"
            >
              Lire la documentation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── Illustrations ────────────────────────────────────────────────── */

function Figure({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div>
      {children}
      <p className="mt-5 font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

/** Quatre plans d'une même scène : description qui dérive, ou description gelée. Schéma, pas capture. */
function DriftRow({ label, cells, stable = false }: { label: string; cells: string[]; stable?: boolean }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm">
        <span className={`size-1.5 rounded-full ${stable ? 'bg-signal' : 'bg-border-strong'}`} />
        <span className={stable ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((c, i) => (
          <div
            key={i}
            className={`flex aspect-video flex-col justify-between rounded-[4px] border p-2.5 ${stable ? 'border-foreground/80 bg-background' : 'border-dashed border-border-strong bg-stage'}`}
          >
            <span className="font-mono text-[10px] text-muted-foreground">plan 1{String.fromCharCode(65 + i)}</span>
            <span className={`font-mono text-[11px] leading-snug ${stable ? 'text-foreground' : 'text-muted-foreground'}`}>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
