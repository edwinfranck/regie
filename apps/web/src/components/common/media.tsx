'use client';

import { ImageIcon, Music, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

export const fileUrl = (assetId: string, download = false) => `/api/files/${assetId}${download ? '?download=1' : ''}`;

/** Aperçu d'un asset sur le plateau neutre, au ratio demandé. */
export function AssetThumb({ asset, ratio, className, fit = 'cover', controls }: { asset?: { id: string; type?: string; mimeType?: string; name?: string } | null; ratio?: string; className?: string; fit?: 'cover' | 'contain'; controls?: boolean }) {
  const [w, h] = (ratio ?? '').split(':').map(Number);
  const style = w && h ? { aspectRatio: `${w} / ${h}` } : undefined;
  const type = asset?.type ?? (asset?.mimeType?.startsWith('video/') ? 'VIDEO' : asset?.mimeType?.startsWith('audio/') ? 'AUDIO' : 'IMAGE');
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden bg-stage', className)} style={style}>
      {!asset ? (
        <ImageIcon className="size-6 text-muted-foreground/60" />
      ) : type === 'VIDEO' ? (
        <video src={fileUrl(asset.id)} className={cn('size-full', fit === 'cover' ? 'object-cover' : 'object-contain')} muted loop playsInline controls={controls} onMouseEnter={(e) => !controls && e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => !controls && e.currentTarget.pause()} preload="metadata" />
      ) : type === 'AUDIO' ? (
        <div className="flex w-full flex-col items-center gap-2 p-3">
          <Music className="size-6 text-muted-foreground" />
          <audio src={fileUrl(asset.id)} controls className="w-full" preload="none" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(asset.id)} alt={asset.name ?? ''} loading="lazy" className={cn('size-full', fit === 'cover' ? 'object-cover' : 'object-contain')} />
      )}
    </div>
  );
}

export const TypeIcon = ({ type, className }: { type: string; className?: string }) => (type === 'VIDEO' ? <Video className={className} /> : type === 'AUDIO' ? <Music className={className} /> : <ImageIcon className={className} />);
