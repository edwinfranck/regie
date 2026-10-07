import type { TEMPLATE_CATEGORIES } from '@regie/core';

export const TEMPLATE_CATEGORY_LABELS: Record<(typeof TEMPLATE_CATEGORIES)[number], string> = {
  SCREENWRITING: 'Scénario',
  CHARACTER: 'Personnage',
  LOCATION: 'Lieu',
  IMAGE: 'Image',
  VIDEO: 'Vidéo',
  CAMERA: 'Caméra',
  LIGHTING: 'Lumière',
  DIALOGUE: 'Dialogue',
  STORYBOARD: 'Storyboard',
  SOUND: 'Son',
};
export const categoryLabel = (c: string) => TEMPLATE_CATEGORY_LABELS[c as keyof typeof TEMPLATE_CATEGORY_LABELS] ?? c;
