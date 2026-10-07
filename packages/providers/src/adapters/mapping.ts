import { dataUri, ratioToDims } from '../http';
import type { ImageRequest, InputFile, VideoRequest } from '../types';

// Les agrégateurs (Fal, Replicate) exposent des centaines de modèles aux
// schémas d'entrée différents mais proches. On envoie les noms de champs les
// plus répandus ; un modèle exotique se règle par `inputMap` et `extraInput`
// dans la configuration du provider, sans toucher au code.

export interface MappingOptions {
  /** Renommage de champs : { image_url: "start_image" }. */
  inputMap?: Record<string, string>;
  /** Champs ajoutés tels quels à chaque requête. */
  extraInput?: Record<string, unknown>;
  /** Encoder les images : data URI (défaut) ou URL publique. */
  imageAs?: (f: InputFile) => string;
}

function finish(input: Record<string, unknown>, o: MappingOptions) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined && v !== null) out[o.inputMap?.[k] ?? k] = v;
  return { ...out, ...(o.extraInput ?? {}) };
}

export function imageInput(req: ImageRequest, o: MappingOptions = {}) {
  const enc = o.imageAs ?? dataUri;
  const refs = req.inputs.filter((i) => i.role === 'reference' || i.role === 'init');
  const { width, height } = req.params.width && req.params.height ? { width: req.params.width, height: req.params.height } : ratioToDims(req.params.aspectRatio);
  return finish(
    {
      prompt: req.prompt,
      negative_prompt: req.negative || undefined,
      aspect_ratio: req.params.aspectRatio,
      image_size: { width, height },
      width,
      height,
      num_inference_steps: req.params.steps,
      guidance_scale: req.params.cfg,
      seed: req.params.seed,
      num_images: req.params.count ?? 1,
      image_url: refs[0] ? enc(refs[0]) : undefined,
      image_urls: refs.length > 1 ? refs.map(enc) : undefined,
    },
    o,
  );
}

export function videoInput(req: VideoRequest, o: MappingOptions = {}) {
  const enc = o.imageAs ?? dataUri;
  const first = req.inputs.find((i) => i.role === 'first_frame' || i.role === 'init');
  const last = req.inputs.find((i) => i.role === 'last_frame');
  const refs = req.inputs.filter((i) => i.role === 'reference');
  return finish(
    {
      prompt: req.prompt,
      negative_prompt: req.negative || undefined,
      aspect_ratio: req.params.aspectRatio,
      duration: req.params.durationSec ? String(Math.round(req.params.durationSec)) : undefined,
      seed: req.params.seed,
      image_url: first ? enc(first) : undefined,
      tail_image_url: last ? enc(last) : undefined,
      reference_image_urls: refs.length ? refs.map(enc) : undefined,
    },
    o,
  );
}

/** Trouve les fichiers produits dans une réponse, quelle que soit sa forme. */
export function collectUrls(output: unknown): string[] {
  const urls: string[] = [];
  const walk = (v: unknown) => {
    if (!v) return;
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v) || v.startsWith('data:')) urls.push(v);
      return;
    }
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.url === 'string') return void urls.push(o.url);
      for (const k of ['images', 'image', 'video', 'videos', 'audio', 'audio_file', 'output', 'outputs', 'file']) if (k in o) walk(o[k]);
    }
  };
  walk(output);
  return [...new Set(urls)];
}

export function fromDataUri(uri: string) {
  const m = uri.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  return { mimeType: m[1], data: Buffer.from(m[2], 'base64') };
}
