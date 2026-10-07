import type { RefImage, ShotSpec } from '../context';

export interface CompiledPrompt {
  target: string;
  text: string;
  negative: string[];
  refs: RefImage[];
  /** Pour une cible vidéo image-to-video : l'image de départ attendue. */
  startFrame?: string;
  notes: string[];
  /** true quand le texte vient d'une réécriture manuelle et non du compilateur. */
  edited?: boolean;
}

export interface Target {
  id: string;
  label: string;
  kind: 'image' | 'video';
  /** Variante de prompt vidéo (§22) : concise, cinematic, technical. */
  variant?: 'concise' | 'cinematic' | 'technical';
  /** Adapters dont c'est la grammaire naturelle. */
  engines?: string[];
  render(spec: ShotSpec): CompiledPrompt;
}

export interface MultiTarget {
  id: string;
  label: string;
  kind: 'image';
  render(specs: ShotSpec[], title: string): CompiledPrompt;
}
