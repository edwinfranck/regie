// Temps de l'éditeur : secondes côté modèle, images côté affichage.

/** Ramène un temps sur la grille des images de la séquence. */
export const toFrame = (t: number, fps: number) => Math.round(t * fps) / fps;

/** Timecode HH:MM:SS:FF, comme les EDL et les logiciels de montage. */
export function timecode(t: number, fps: number) {
  const f = Math.max(0, Math.round(t * fps));
  const hh = Math.floor(f / (3600 * fps));
  const mm = Math.floor((f % (3600 * fps)) / (60 * fps));
  const ss = Math.floor((f % (60 * fps)) / fps);
  const ff = f % fps;
  return [hh, mm, ss, ff].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Durée lisible : 1 min 04 s, 12,5 s. */
export function humanDuration(t: number) {
  if (!Number.isFinite(t) || t <= 0) return '0 s';
  if (t < 60) return `${(Math.round(t * 10) / 10).toLocaleString('fr-FR')} s`;
  const m = Math.floor(t / 60);
  const s = Math.round(t % 60);
  return `${m} min ${String(s).padStart(2, '0')} s`;
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
