'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AssetThumb, fileUrl } from '../common/media';

/** Aperçu grand format d'un résultat, avec téléchargement et actions. */
export function AssetPreview({ asset, onOpenChange, title, description, actions }: { asset: { id: string; type: string; name?: string } | null; onOpenChange: (o: boolean) => void; title?: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Dialog open={!!asset} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title ?? asset?.name ?? 'Aperçu'}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">Aperçu du fichier</DialogDescription>}
        </DialogHeader>
        {asset && <AssetThumb asset={asset} fit="contain" controls className={asset.type === 'AUDIO' ? 'rounded-sm py-10' : 'h-[65vh] rounded-sm'} />}
        <div className="flex flex-wrap items-center gap-2">
          {asset && (
            <Button variant="outline" size="sm" asChild>
              <a href={fileUrl(asset.id, true)}>
                <Download /> Télécharger
              </a>
            </Button>
          )}
          {actions}
        </div>
      </DialogContent>
    </Dialog>
  );
}
