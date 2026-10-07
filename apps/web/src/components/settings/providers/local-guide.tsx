'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const COMFY_VARS = ['prompt', 'negative', 'seed', 'width', 'height', 'steps', 'cfg', 'image', 'image_last', 'frames'];

/** Local ou cloud : comment brancher Ollama et ComfyUI sur sa propre machine. */
export function LocalGuide() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-4 py-3 text-left font-medium hover:bg-accent/50">
        <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
        Local ou cloud
        <span className="font-normal text-muted-foreground">— faire tourner les modèles sur votre machine</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-6 border-t px-4 py-4 text-sm lg:grid-cols-2">
        <div className="space-y-2">
          <p className="font-medium">Ollama — texte, gratuit et hors ligne</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Installez Ollama et lancez-le : il écoute sur <code className="font-mono text-foreground">http://localhost:11434</code>.</li>
            <li>
              Téléchargez un modèle : <code className="font-mono text-foreground">ollama pull llama3.2</code>.
            </li>
            <li>Ici, ajoutez « Ollama (local) » en gardant cette URL, testez la connexion, puis « Découvrir les modèles ».</li>
          </ol>
          <p className="text-muted-foreground">Si régie tourne dans Docker, l’URL devient souvent <code className="font-mono text-foreground">http://host.docker.internal:11434</code>.</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium">ComfyUI — images et vidéos avec vos workflows</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Dans ComfyUI, activez le mode développeur et exportez chaque workflow avec « Save (API) ».</li>
            <li>Remplacez les valeurs à piloter par des variables entre doubles accolades.</li>
            <li>Collez les workflows dans le champ « Workflows » du provider (un par clé), puis découvrez les modèles.</li>
          </ol>
          <div className="flex flex-wrap gap-1">
            {COMFY_VARS.map((v) => (
              <code key={v} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs">{`{{${v}}}`}</code>
            ))}
          </div>
          <p className="text-muted-foreground">
            <code className="font-mono text-foreground">{'{{image}}'}</code> reçoit l’image de référence ou de départ, <code className="font-mono text-foreground">{'{{image_last}}'}</code> la dernière image d’un plan, <code className="font-mono text-foreground">{'{{frames}}'}</code> le nombre d’images d’une vidéo.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
