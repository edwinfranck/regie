import { ProviderError, fromStatus } from '../errors';
import { http, need, rawFetch } from '../http';
import type { ProviderAdapter, ProviderConfig } from '../types';

// ElevenLabs : voix (synthèse, voix clonées déjà créées dans le compte) et
// effets sonores. Le clonage se fait dans leur interface, où le consentement
// de la personne est vérifié : régie n'utilise que des voix existantes.

const base = (cfg: ProviderConfig) => (cfg.baseUrl || 'https://api.elevenlabs.io/v1').replace(/\/$/, '');
const headers = (cfg: ProviderConfig) => ({ 'xi-api-key': need(cfg.apiKey, 'Clé API manquante.'), 'Content-Type': 'application/json' });

export const elevenlabs: ProviderAdapter = {
  meta: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    description: 'Voix, narration, dialogues et effets sonores.',
    capabilities: ['AUDIO'],
    needsApiKey: true,
    docsUrl: 'https://elevenlabs.io/docs',
    fields: [{ key: 'defaultVoiceId', label: 'Voix par défaut', type: 'text', placeholder: 'ID de voix ElevenLabs' }],
    presets: [
      { modelId: 'eleven_multilingual_v2', label: 'Multilingual v2', capability: 'AUDIO', modes: ['text-to-speech'], pricing: { unit: '1k_chars', usd: 0.18 }, quality: 5, speed: 3 },
      { modelId: 'eleven_flash_v2_5', label: 'Flash v2.5', capability: 'AUDIO', modes: ['text-to-speech'], pricing: { unit: '1k_chars', usd: 0.09 }, quality: 4, speed: 5 },
      { modelId: 'sound-effects', label: 'Effets sonores', capability: 'AUDIO', modes: ['sound-effect'], pricing: { unit: 'request', usd: 0.1 }, quality: 4, speed: 4 },
    ],
  },
  audio: {
    async generate(cfg, req, ctx) {
      let res: Response;
      if (req.mode === 'sound-effect') {
        res = await rawFetch(`${base(cfg)}/sound-generation`, { method: 'POST', headers: headers(cfg), body: JSON.stringify({ text: req.prompt, ...(req.params.durationSec ? { duration_seconds: Math.min(22, req.params.durationSec) } : {}) }) }, ctx);
      } else if (req.mode === 'text-to-speech') {
        const voice = req.params.voiceId || (cfg.config.defaultVoiceId as string);
        if (!voice) throw new ProviderError('invalid_input', 'Choisir une voix (ou une voix par défaut dans le provider).');
        res = await rawFetch(`${base(cfg)}/text-to-speech/${voice}?output_format=mp3_44100_128`, { method: 'POST', headers: headers(cfg), body: JSON.stringify({ text: req.prompt, model_id: req.model }) }, ctx);
      } else throw new ProviderError('unsupported');
      if (!res.ok) throw fromStatus(res.status, await res.text());
      return {
        outputs: [{ data: Buffer.from(await res.arrayBuffer()), mimeType: 'audio/mpeg', durationSec: req.params.durationSec }],
        usage: req.mode === 'text-to-speech' ? { units: req.prompt.length / 1000, unit: '1k_chars' } : { units: 1, unit: 'request' },
      };
    },
  },
  async test(cfg) {
    const j = await http(`${base(cfg)}/voices`, { headers: headers(cfg), timeoutMs: 15_000 });
    return { ok: true, message: `${j.voices?.length ?? 0} voix disponibles.` };
  },
};
