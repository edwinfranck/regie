'use client';

import { ANGLES, LENSES, MOVES, SIZES, STAGE_LABELS, STAGES, TIME_LABELS, TIMES_OF_DAY, TRANSITIONS, cameraFr } from '@regie/core';
import { useQuery } from '@tanstack/react-query';
import { useProjectId } from '@/hooks/use-project';
import { get } from '@/lib/client';

// Vocabulaire et petits calculs partagés par la scène, le storyboard et le
// tableau de production. Les libellés viennent de @regie/core : un seul
// vocabulaire pour l'interface et pour les prompts.

export const SETTING_LABELS: Record<string, string> = { INT: 'INT.', EXT: 'EXT.', INT_EXT: 'INT./EXT.' };
export const SETTING_OPTIONS = Object.entries(SETTING_LABELS).map(([value, label]) => ({ value, label }));
export const TIME_OPTIONS = TIMES_OF_DAY.map((t) => ({ value: t, label: TIME_LABELS[t] ?? t }));
export const STAGE_OPTIONS = STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));
export const IMPORTANCE_LABELS: Record<number, string> = { 1: 'Secondaire', 2: 'Importante', 3: 'Essentielle' };
export const IMPORTANCE_OPTIONS = [1, 2, 3].map((n) => ({ value: String(n), label: IMPORTANCE_LABELS[n] }));

export const SIZE_OPTIONS = Object.entries(SIZES).map(([value, t]) => ({ value, label: t.fr }));
export const ANGLE_OPTIONS = Object.entries(ANGLES).map(([value, t]) => ({ value, label: t.fr }));
export const MOVE_OPTIONS = Object.entries(MOVES).map(([value, t]) => ({ value, label: t.fr }));
export const LENS_OPTIONS = LENSES.map((l) => ({ value: l, label: l }));
export const TRANSITION_OPTIONS = Object.entries(TRANSITIONS).map(([value, label]) => ({ value, label }));

/** Rappel caméra en français, sans jamais planter sur une valeur inconnue. */
export function cameraLabel(s: { size?: string | null; angle?: string | null; lens?: string | null; move?: string | null }) {
  try {
    return cameraFr({ size: s.size, angle: s.angle, lens: s.lens, move: s.move });
  } catch {
    return [s.size, s.angle, s.lens, s.move].filter(Boolean).join(' · ');
  }
}

/** « INT. ATELIER — Nuit » */
export function sceneHeading(s: { setting?: string; timeOfDay?: string; title?: string; location?: { name: string } | null }) {
  const place = s.location?.name || s.title || 'Lieu à définir';
  return `${SETTING_LABELS[s.setting ?? 'INT'] ?? s.setting} ${place.toUpperCase()} — ${TIME_LABELS[s.timeOfDay ?? ''] ?? s.timeOfDay ?? ''}`;
}

export function fmtDuration(sec?: number | null) {
  if (!sec) return '—';
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
}

export const shotsSeconds = (shots: { durationSec?: number }[] = []) => shots.reduce((a, s) => a + (s.durationSec ?? 0), 0);

/**
 * L'image de chaque plan : celle retenue pour la case, sinon la plus récente
 * qui lui est liée. Une seule requête sur les images du projet plutôt qu'une
 * par plan ; au-delà de 200 images, les plus anciennes ne sont pas vues.
 */
export function useShotImages() {
  const projectId = useProjectId();
  const q = useQuery({
    queryKey: ['assets', projectId, 'shot-images'],
    queryFn: () => get<{ items: { id: string; links: { shotId: string | null }[] }[] }>(`/api/projects/${projectId}/assets?type=IMAGE&take=200`),
  });
  const latest = new Map<string, string>();
  for (const a of q.data?.items ?? []) for (const l of a.links) if (l.shotId && !latest.has(l.shotId)) latest.set(l.shotId, a.id);
  const imageOf = (shot: { id: string; frameAssetId?: string | null; frameAsset?: { id: string } | null }) => shot.frameAsset?.id ?? shot.frameAssetId ?? latest.get(shot.id) ?? null;
  return { imageOf, isLoading: q.isLoading };
}

/** Les options de la bible pour les listes déroulantes et les pastilles. */
export const bibleOptions = (rows: any[] | undefined) => (rows ?? []).map((r) => ({ value: r.id as string, label: `${r.code} ${r.name}`, title: r.short || undefined }));
