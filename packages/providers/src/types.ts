// Le contrat entre régie et les fournisseurs d'IA. Aucune partie de
// l'application n'appelle une API de génération directement : tout passe par
// un adapter qui implémente une ou plusieurs de ces interfaces. Changer de
// fournisseur, c'est changer d'adapter, rien d'autre.

export type Capability = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'EMBEDDING';

/** La configuration d'un provider telle que stockée en base, clé déchiffrée. */
export interface ProviderConfig {
  id: string;
  name: string;
  adapter: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  config: Record<string, unknown>;
}

/** Un fichier d'entrée : référence, première image, dernière image, image source. */
export interface InputFile {
  role: 'reference' | 'first_frame' | 'last_frame' | 'init' | 'mask' | 'audio';
  mimeType: string;
  /** Contenu binaire, toujours disponible. */
  data: Buffer;
  /** URL publique si le stockage en expose une (certains providers l'exigent). */
  url?: string | null;
  /** Tag de référence (CH1, L2…) pour les providers qui en tiennent compte. */
  tag?: string | null;
  name?: string;
}

export interface OutputFile {
  mimeType: string;
  data?: Buffer;
  url?: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  /** Unités facturables : images, secondes, caractères… */
  units?: number;
  unit?: 'image' | 'second' | '1k_tokens' | 'request' | '1k_chars';
}

export interface GenerationResult {
  outputs: OutputFile[];
  text?: string;
  usage?: Usage;
  externalId?: string;
  /** Coût renvoyé par le provider quand il le fournit (sinon estimé). */
  costUsd?: number;
}

export interface RunContext {
  signal?: AbortSignal;
  /** Progression 0–100, remontée en temps réel à l'interface. */
  onProgress?: (percent: number, message?: string) => void;
  /** Identifiant externe connu dès la soumission (reprise après crash). */
  onExternalId?: (id: string) => void;
}

export interface ImageParams {
  aspectRatio?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  count?: number;
  quality?: 'draft' | 'standard' | 'high';
}

export interface ImageRequest {
  model: string;
  mode: 'text-to-image' | 'image-to-image';
  prompt: string;
  negative?: string;
  params: ImageParams;
  inputs: InputFile[];
}

export interface VideoParams {
  aspectRatio?: string;
  resolution?: string;
  durationSec?: number;
  fps?: number;
  seed?: number;
  motionStrength?: number;
  cameraMovement?: string;
}

export interface VideoRequest {
  model: string;
  mode: 'text-to-video' | 'image-to-video' | 'first-last-frame' | 'reference-to-video';
  prompt: string;
  negative?: string;
  params: VideoParams;
  inputs: InputFile[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TextRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Demande une réponse JSON (le prompt doit décrire la forme attendue). */
  json?: boolean;
}

export interface AudioRequest {
  model: string;
  mode: 'text-to-speech' | 'sound-effect' | 'music';
  prompt: string;
  params: { voiceId?: string; durationSec?: number; format?: string };
  inputs: InputFile[];
}

export interface ImageProvider {
  generate(cfg: ProviderConfig, req: ImageRequest, ctx: RunContext): Promise<GenerationResult>;
}
export interface VideoProvider {
  generate(cfg: ProviderConfig, req: VideoRequest, ctx: RunContext): Promise<GenerationResult>;
}
export interface TextProvider {
  generate(cfg: ProviderConfig, req: TextRequest, ctx: RunContext): Promise<GenerationResult>;
  /** Streaming token par token, pour l'assistant. */
  stream?(cfg: ProviderConfig, req: TextRequest, ctx: RunContext): AsyncIterable<string | { done: GenerationResult }>;
}
export interface AudioProvider {
  generate(cfg: ProviderConfig, req: AudioRequest, ctx: RunContext): Promise<GenerationResult>;
}

/** Un modèle proposé par défaut quand on branche l'adapter. Tout reste éditable. */
export interface ModelPreset {
  modelId: string;
  label: string;
  capability: Capability;
  modes: string[];
  pricing?: { unit: Usage['unit']; usd: number };
  quality?: number;
  speed?: number;
  maxDuration?: number;
  aspectRatios?: string[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'json';
  placeholder?: string;
  help?: string;
  required?: boolean;
}

/**
 * Un service connu qui parle le protocole de l'adapter (DeepInfra, Groq… pour
 * « openai-compatible ») : l'interface s'en sert pour pré-remplir nom et URL.
 */
export interface KnownEndpoint {
  id: string;
  label: string;
  baseUrl: string;
  docsUrl?: string;
  capabilities: Capability[];
  note?: string;
}

export interface AdapterMeta {
  id: string;
  label: string;
  description: string;
  capabilities: Capability[];
  /** Tourne sur la machine de l'utilisateur (Ollama, ComfyUI…). */
  local?: boolean;
  needsApiKey: boolean;
  /** Clé facultative mais proposée à l'ajout (services cloud derrière un adapter générique). */
  optionalApiKey?: boolean;
  needsBaseUrl?: boolean;
  defaultBaseUrl?: string;
  docsUrl?: string;
  /** Champs de configuration propres à l'adapter. */
  fields?: ConfigField[];
  /** L'adapter a-t-il besoin d'URLs publiques pour les images d'entrée ? */
  needsPublicInputUrls?: boolean;
  presets: ModelPreset[];
  /** Services connus joignables avec cet adapter. */
  endpoints?: KnownEndpoint[];
}

export interface ProviderAdapter {
  meta: AdapterMeta;
  text?: TextProvider;
  image?: ImageProvider;
  video?: VideoProvider;
  audio?: AudioProvider;
  /** Vérifie la connexion et la clé, sans rien générer de facturable. */
  test?(cfg: ProviderConfig): Promise<{ ok: boolean; message: string }>;
  /** Découvre les modèles disponibles (Ollama, ComfyUI, OpenAI-compatible). */
  listModels?(cfg: ProviderConfig): Promise<ModelPreset[]>;
}
