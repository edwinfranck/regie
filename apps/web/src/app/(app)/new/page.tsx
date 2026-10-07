'use client';

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { post, toastError } from '@/lib/client';
import { cn } from '@/lib/utils';
import { useModels, usable } from '@/components/common/model-picker';
import { Choice } from '@/components/common/choice';

// Premier lancement : « Que voulez-vous créer ? », puis « Décrivez votre idée ».
const KINDS = [
  { kind: 'FEATURE', label: 'Film', hint: 'Long-métrage', ratio: '2.39:1' },
  { kind: 'SERIES', label: 'Série', hint: 'Plusieurs épisodes', ratio: '16:9' },
  { kind: 'SHORT', label: 'Court métrage', hint: 'Moins de 30 minutes', ratio: '16:9' },
  { kind: 'MUSIC_VIDEO', label: 'Clip', hint: 'Sur une musique', ratio: '16:9' },
  { kind: 'COMMERCIAL', label: 'Publicité', hint: 'Un message, un produit', ratio: '16:9' },
  { kind: 'ANIMATION', label: 'Animation', hint: 'Dessin animé, anime, 3D', ratio: '16:9' },
  { kind: 'VERTICAL', label: 'Vidéo verticale', hint: 'Réseaux sociaux', ratio: '9:16' },
  { kind: 'DOCUMENTARY', label: 'Documentaire', hint: 'Le réel', ratio: '16:9' },
] as const;

const RATIOS = ['16:9', '9:16', '2.39:1', '1.85:1', '4:3', '1:1', '4:5'];

export default function NewProject() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<(typeof KINDS)[number]>(KINDS[2]);
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [ratio, setRatio] = useState<string>(KINDS[2].ratio);
  const [busy, setBusy] = useState(false);
  const { data: textModels = [] } = useModels('TEXT');
  const canDraft = textModels.some(usable);

  async function create() {
    setBusy(true);
    try {
      const p = await post('/api/projects', { title: title.trim() || 'Sans titre', kind: kind.kind, aspectRatio: ratio, idea: idea.trim() || undefined });
      router.push(`/projects/${p.id}/concept${idea.trim() && canDraft ? '?draft=1' : ''}`);
    } catch (e) {
      toastError(e);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-14">
      {step === 1 ? (
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Nouveau projet · 1/2</p>
            <h1 className="text-3xl font-semibold tracking-tight">Que voulez-vous créer ?</h1>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                onClick={() => {
                  setKind(k);
                  setRatio(k.ratio);
                }}
                className={cn('rounded-md border p-4 text-left transition-colors', kind.kind === k.kind ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}
              >
                <div className="font-medium">{k.label}</div>
                <div className={cn('text-sm', kind.kind === k.kind ? 'text-background/70' : 'text-muted-foreground')}>{k.hint}</div>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="lg" onClick={() => setStep(2)}>
              Continuer <ArrowRight />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nouveau projet · {kind.label} · 2/2
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Décrivez votre idée.</h1>
            <p className="text-muted-foreground">
              Quelques phrases suffisent : qui, quoi, où, quel ton.{' '}
              {canDraft ? 'L’IA en tirera un premier concept (logline, synopsis, personnages), que vous pourrez tout modifier.' : 'Aucun modèle de texte n’est configuré : vous écrirez le concept vous-même, ou brancherez un provider plus tard.'}
            </p>
          </div>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Titre, même provisoire</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sans titre" autoFocus className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idea">L’idée</Label>
              <Textarea
                id="idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={7}
                className="text-base"
                placeholder="Une jeune couturière de Dakar découvre que les robes qu’elle coud réalisent le vœu de celles qui les portent — mais chaque vœu exaucé coûte un souvenir à quelqu’un de sa famille."
              />
            </div>
            <Choice label="Format d’image" value={ratio} onChange={(v) => v && setRatio(v)} options={RATIOS.map((r) => ({ value: r, label: r, hint: r === '9:16' ? 'vertical' : r === '2.39:1' ? 'scope' : undefined }))} className="max-w-xs" />
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft /> Retour
            </Button>
            <Button size="lg" onClick={create} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {idea.trim() && canDraft ? 'Créer et proposer un concept' : 'Créer le projet'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
