'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/client';

// Mêmes règles que le serveur (assets/route.ts) : on refuse tôt ce qui sera
// refusé de toute façon, pour ne pas envoyer 50 Mo pour rien.
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,application/pdf';
const ALLOWED = new Set(ACCEPT.split(','));
export const MAX_MB = 50;

export function checkFile(f: File): string | null {
  if (f.type && !ALLOWED.has(f.type)) return `${f.name} : type non accepté (images, vidéos, audio, PDF).`;
  if (f.size > MAX_MB * 1024 * 1024) return `${f.name} dépasse ${MAX_MB} Mo.`;
  return null;
}

/** Envoi multipart avec progression (fetch ne sait pas suivre l'upload). */
export function uploadFiles(projectId: string, files: File[], extra: Record<string, string> = {}, onProgress?: (pct: number) => void): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append('file', f);
    for (const [k, v] of Object.entries(extra)) if (v) form.append(k, v);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/projects/${projectId}/assets`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data?.error ?? `Erreur ${xhr.status}`, xhr.status, data?.code, data?.action));
    };
    xhr.onerror = () => reject(new ApiError('Connexion interrompue pendant l’envoi.', 0));
    xhr.send(form);
  });
}

/** État d'envoi partagé par la page assets et le sélecteur d'entrées. */
export function useUpload(projectId: string) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const upload = useCallback(
    async (list: File[], extra: Record<string, string> = {}) => {
      const bad = list.map(checkFile).filter((e): e is string => !!e);
      const ok = list.filter((f) => !checkFile(f));
      setErrors(bad);
      if (!ok.length) return [];
      setProgress(0);
      try {
        const created = await uploadFiles(projectId, ok, extra, setProgress);
        toast.success(created.length > 1 ? `${created.length} fichiers ajoutés` : 'Fichier ajouté');
        qc.invalidateQueries({ queryKey: ['assets'] });
        return created as any[];
      } catch (e) {
        setErrors((prev) => [...prev, e instanceof Error ? e.message : 'Envoi impossible.']);
        return [];
      } finally {
        setProgress(null);
      }
    },
    [projectId, qc],
  );

  return { upload, progress, errors, clearErrors: () => setErrors([]) };
}
