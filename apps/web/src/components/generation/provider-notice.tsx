'use client';

import { CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useModels, usable } from '../common/model-picker';

const WHAT: Record<string, string> = { IMAGE: 'd’images', VIDEO: 'de vidéos', AUDIO: 'audio' };

/** Encart affiché tant qu'aucun modèle n'est utilisable pour la capacité. */
export function ProviderNotice({ capability }: { capability: 'IMAGE' | 'VIDEO' | 'AUDIO' }) {
  const { data: models, isLoading } = useModels(capability);
  if (isLoading || !models || models.some(usable)) return null;
  const known = models.length > 0;
  return (
    <div className="mx-8 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/50 bg-warning/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <p className="font-medium">Provider non configuré</p>
          <p className="text-sm text-muted-foreground">
            {known ? `Des modèles ${WHAT[capability]} existent, mais leur provider n’a pas de clé ou est désactivé.` : `Aucun modèle de génération ${WHAT[capability]} n’est déclaré.`} Le formulaire reste utilisable pour préparer le prompt ; la génération sera refusée tant qu’un provider n’est pas configuré.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/settings/providers">Configurer un provider</Link>
      </Button>
    </div>
  );
}
