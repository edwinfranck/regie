import { Clapperboard, Download } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Export' };

type Format = { label: string; format?: string; extra?: string; soon?: string; page?: string };
type Card = { title: string; description: string; formats: Format[] };

const CARDS: Card[] = [
  {
    title: 'Scénario',
    description: 'Le scénario en mise en page standard (Courier 12), en Word, en Final Draft et en Fountain pour les logiciels d’écriture, ou en texte brut.',
    formats: [{ label: 'PDF', format: 'pdf' }, { label: 'Fountain', format: 'fountain' }, { label: 'TXT', format: 'txt' }, { label: 'DOCX', format: 'docx' }, { label: 'Final Draft', format: 'fdx' }],
  },
  {
    title: 'Projet complet',
    description: 'Tout le projet en un fichier : concept, histoire, monde, bible, scénario, scènes, plans, storyboards. Pour archiver ou réimporter.',
    formats: [{ label: 'JSON', format: 'json' }],
  },
  {
    title: 'Liste des plans',
    description: 'Un plan par ligne : scène, code, durée, cadre, lieu, personnages, action, dialogue, transition, statut. S’ouvre dans un tableur.',
    formats: [{ label: 'CSV', format: 'csv' }],
  },
  {
    title: 'Storyboard',
    description: 'Les plans avec leur image, en planches imprimables ; ou toutes les images du projet en fichiers séparés.',
    formats: [{ label: 'PDF', format: 'storyboard' }, { label: 'Images (ZIP)', format: 'assets', extra: '&type=IMAGE' }],
  },
  {
    title: 'Assets',
    description: 'Tous les fichiers du projet (images, vidéos, audio, documents) rangés par type, dans une archive. 500 fichiers au plus par export.',
    formats: [{ label: 'ZIP', format: 'assets' }],
  },
  {
    title: 'Film',
    description: 'Le film se rend depuis le montage, en MP4 ou MOV : le fichier rejoint ensuite les assets. Sous-titres en SRT et EDL pour Premiere ou Resolve.',
    formats: [{ label: 'Ouvrir le montage', page: 'timeline' }],
  },
];

export default async function ExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <div>
      <PageHeader title="Export" description="Chaque export est produit à la demande depuis l’état actuel du projet." />
      <div className="grid gap-4 p-8 md:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((c) => (
          <section key={c.title} className="flex flex-col rounded-md border bg-card p-5">
            <h2 className="font-medium">{c.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {c.formats.map((f) =>
                f.page ? (
                  <Button key={f.label} variant="outline" size="sm" asChild>
                    <a href={`/projects/${projectId}/${f.page}`}>
                      <Clapperboard /> {f.label}
                    </a>
                  </Button>
                ) : f.soon ? (
                  <Button key={f.label} variant="outline" size="sm" disabled title={f.soon}>
                    {f.label} <span className="text-xs text-muted-foreground">{f.soon}</span>
                  </Button>
                ) : (
                  <Button key={f.label} variant="outline" size="sm" asChild>
                    <a href={`/api/projects/${projectId}/export?format=${f.format}${f.extra ?? ''}`} download>
                      <Download /> {f.label}
                    </a>
                  </Button>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
