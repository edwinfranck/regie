# Providers

Un **provider** est un compte chez un fournisseur (ou un serveur local) ; un
**adapter** est le code qui sait lui parler ; un **modèle** est ce qu'on
choisit au moment de générer. Aucune partie de l'application n'appelle une
API de génération directement.

```
Provider Registry
  Provider (clé chiffrée, URL, config)
    ↓
  Capability : TEXT · IMAGE · VIDEO · AUDIO · EMBEDDING
    ↓
  Model (id chez le provider, modes, prix, qualité, vitesse)
    ↓
  Adapter (packages/providers/src/adapters/*)
    ↓
  Request → Job (BullMQ) → Result (fichiers, usage)
```

## Adapters disponibles

| Adapter | Capacités | Notes |
|---|---|---|
| `openai` | texte, image (gpt-image, avec références), vidéo (Sora 2), voix (TTS) | |
| `anthropic` | texte | SDK officiel ; bascule serveur en cas de refus sur les modèles qui l'acceptent |
| `google` | texte (Gemini), image (Gemini Image, Imagen), vidéo (Veo, avec première et dernière image) | |
| `fal` | image, vidéo, audio | Flux, SDXL, Kling, Hailuo, Veo, Luma… via une seule clé |
| `replicate` | image, vidéo, audio | modèles officiels (`owner/name`) ou communautaires (`owner/name:version`) |
| `runway` | image (Gen-4 Image, références taguées), vidéo (Gen-4 Turbo, première et dernière image) | |
| `luma` | image (Photon), vidéo (Ray 2) | exige des URLs publiques : `S3_PUBLIC_URL` |
| `elevenlabs` | voix, effets sonores | voix existantes du compte ; le clonage se fait chez eux |
| `ollama` | texte | local ; découverte des modèles installés |
| `comfyui` | image, vidéo | local ; vos workflows exportés en « API » |
| `openai-compatible` | texte, image | DeepInfra, Together, OpenRouter, Groq, Mistral… et LM Studio, vLLM, llama.cpp ; clé facultative |
| `custom-http` | tout | endpoint maison synchrone, corps JSON à variables |

Les modèles proposés à l'ajout d'un provider (presets) sont un point de
départ : identifiants et prix se modifient dans **Réglages → Providers IA**.
Les prix servent à l'estimation des coûts ; vérifiez-les chez le fournisseur.

## Brancher un provider

Dans l'interface : **Réglages → Providers IA → Ajouter**. Un provider peut
être déclaré pour toute l'instance (administrateur) ou pour un espace de
travail. La clé est chiffrée (AES-256-GCM) avant d'être écrite ; l'interface
n'en affiche que les quatre derniers caractères. **Tester la connexion**
vérifie la clé sans rien générer de facturable.

Au premier lancement, `pnpm db:seed` crée les providers dont une variable
`SEED_*` est posée dans `.env`.

### Local : Ollama

URL `http://localhost:11434`. **Découvrir les modèles** liste ceux qui sont
installés (`ollama pull …`). Coût nul, rien ne sort de la machine.

### Local : ComfyUI

URL de l'instance (par défaut `http://127.0.0.1:8188`) et, dans le champ
**Workflows**, un objet JSON : une clé par workflow, chacun exporté avec
« Save (API) » :

```json
{
  "flux-portrait": {
    "label": "Portrait Flux",
    "capability": "IMAGE",
    "graph": { "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "{{prompt}}", "clip": ["4", 1] } }, "…": {} }
  }
}
```

Variables remplacées à l'envoi : `{{prompt}}`, `{{negative}}`, `{{seed}}`,
`{{width}}`, `{{height}}`, `{{steps}}`, `{{cfg}}`, `{{image}}` (première image
ou référence, envoyée par `/upload/image`), `{{image_last}}`, `{{frames}}`.
Une variable seule dans une chaîne (`"{{seed}}"`) devient un nombre. Chaque
workflow devient un modèle (**Découvrir les modèles**) : génération,
upscale, inpainting, cohérence de visage, transfert de style, vidéo Wan ou LTX
— tout ce que le graphe sait faire.

## Brancher un fournisseur peu connu

Le catalogue n'a pas d'adapter par fournisseur, et n'en a pas besoin : dans
**Réglages → Providers IA**, la carte **Autre fournisseur** mène aux deux
adapters génériques. Dans l'ordre :

### 1. Il parle le format OpenAI → `openai-compatible`

C'est le cas de la plupart des services à clé API. Leur documentation parle
d'« OpenAI-compatible API » et donne une URL de base qui finit souvent par
`/v1`. À l'ajout, choisissez le service dans la liste (nom et URL se
pré-remplissent, le lien de sa doc s'affiche) ou « Autre service (URL
personnalisée) », collez la clé, puis **Découvrir les modèles** : régie lit
`GET /models` et classe chaque modèle en texte, image ou embedding, d'après
les métadonnées quand le service en donne (`type` chez Together,
`architecture.output_modalities` chez OpenRouter), sinon d'après
l'identifiant (`flux`, `sdxl`, `stable-diffusion`, `dall-e`, `imagen`,
`recraft`, `ideogram`… → image ; `embed`, `bge`, `e5`… → embedding).

| Service | URL de base | Capacités |
|---|---|---|
| DeepInfra | `https://api.deepinfra.com/v1/openai` | texte, image, embedding |
| Together AI | `https://api.together.xyz/v1` | texte, image, embedding |
| OpenRouter | `https://openrouter.ai/api/v1` | texte |
| Groq | `https://api.groq.com/openai/v1` | texte |
| Fireworks AI | `https://api.fireworks.ai/inference/v1` | texte, embedding |
| Mistral AI | `https://api.mistral.ai/v1` | texte, embedding |
| DeepSeek | `https://api.deepseek.com/v1` | texte |
| xAI (Grok) | `https://api.x.ai/v1` | texte |
| Novita AI | `https://api.novita.ai/v3/openai` | texte (URL à vérifier) |
| Hyperbolic | `https://api.hyperbolic.xyz/v1` | texte |
| SiliconFlow | `https://api.siliconflow.com/v1` (Chine : `.cn`) | texte, embedding |
| Cerebras | `https://api.cerebras.ai/v1` | texte |
| Nebius AI Studio | `https://api.studio.nebius.com/v1` | texte, image (URL à vérifier) |
| Perplexity | `https://api.perplexity.ai` | texte (modèles à ajouter à la main) |
| Moonshot AI | `https://api.moonshot.ai/v1` | texte |
| Alibaba Cloud (Qwen) | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | texte, embedding |
| LM Studio (local) | `http://localhost:1234/v1` | texte |
| vLLM (local) | `http://localhost:8000/v1` | texte |
| llama.cpp server (local) | `http://localhost:8080/v1` | texte |

La liste vit dans `packages/providers/src/adapters/openai.ts`
(`meta.endpoints`) : ajouter un service, c'est une ligne. Les images passent
par `POST /images/generations` ; un service dont l'API d'images a sa propre
forme (Fireworks, Hyperbolic, SiliconFlow) se branche en texte ici et en
images par l'API personnalisée. Replicate et fal, qui hébergent des milliers
de modèles, ont leurs propres adapters.

### 2. Il a son propre format, en une requête → `custom-http`

L'URL de base est alors l'endpoint complet. La clé, facultative, part en
`Authorization: Bearer …` ; d'autres en-têtes se déclarent dans **En-têtes**.
On décrit le corps avec des variables, et l'endroit où lire le résultat :

```json
{
  "model": "flux-dev",
  "prompt": "{{prompt}}",
  "negative_prompt": "{{negative}}",
  "width": "{{width}}",
  "height": "{{height}}",
  "seed": "{{seed}}"
}
```

Chemin du résultat : `images.0.url` pour une réponse
`{ "images": [{ "url": "https://…" }] }`. La valeur trouvée peut être une
URL, une data URI ou du base64 brut (préciser alors le type, `image/png`).
Variables : `{{prompt}}`, `{{negative}}`, `{{seed}}`, `{{width}}`,
`{{height}}`, `{{aspect_ratio}}`, `{{duration}}`, `{{image}}` (data URI de
la première image d'entrée). En texte, le chemin désigne la chaîne à lire
(`choices.0.text`, `output`…). Déclarez ensuite les modèles à la main.

### 3. Sinon → écrire un adapter

Service asynchrone (soumission puis sondage), fichiers en multipart,
authentification signée : voir [Ajouter un adapter](#ajouter-un-adapter).
Une cinquantaine de lignes suffisent le plus souvent.

## Routage

Pour chaque tâche (`TEXT`, `IMAGE_GENERATION`, `VIDEO_GENERATION`,
`AUDIO_GENERATION`, `EMBEDDING`), une liste ordonnée de modèles peut être
déclarée (instance, surchargeable par espace de travail). En mode **AUTO** :

1. les modèles d'une autre capacité, désactivés, sans clé, qui ne font pas le
   mode demandé ou trop courts pour la durée demandée sont écartés (avec la
   raison) ;
2. les modèles routés passent en premier, dans leur ordre ;
3. les autres sont notés sur qualité, coût et vitesse selon la préférence
   (`quality` par défaut, `cost`, `speed`) ; un format d'image non natif
   pénalise.

L'utilisateur peut toujours forcer un modèle. Le code : `packages/providers/src/router.ts`
(fonction pure, testée) et `packages/studio/src/providers.ts`.

Sans aucun candidat, la demande est refusée **avant** d'entrer en file :
HTTP 424, code `provider_not_configured`, avec l'action « Configurer un
provider ».

## Ajouter un adapter

1. Créer `packages/providers/src/adapters/mon-provider.ts` :

```ts
import type { ProviderAdapter } from '../types';
import { http, need, poll, download } from '../http';

export const monProvider: ProviderAdapter = {
  meta: {
    id: 'mon-provider',
    label: 'Mon provider',
    description: 'Ce qu’il sait faire, en une phrase.',
    capabilities: ['IMAGE'],
    needsApiKey: true,
    presets: [{ modelId: 'image-v1', label: 'Image v1', capability: 'IMAGE', modes: ['text-to-image'], pricing: { unit: 'image', usd: 0.03 } }],
  },
  image: {
    async generate(cfg, req, ctx) {
      const key = need(cfg.apiKey, 'Clé API manquante.');
      const job = await http('https://api.example.com/v1/images', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: JSON.stringify({ prompt: req.prompt }) }, ctx);
      ctx.onExternalId?.(job.id);
      const done = await poll(async () => {
        const s = await http(`https://api.example.com/v1/images/${job.id}`, { headers: { Authorization: `Bearer ${key}` } }, ctx);
        return s.status === 'done' ? { done: true, value: s } : { done: false, progress: s.progress };
      }, ctx);
      return { outputs: [await download(done.url, {}, ctx)], usage: { units: 1, unit: 'image' } };
    },
  },
  async test(cfg) {
    await http('https://api.example.com/v1/me', { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    return { ok: true, message: 'Clé valide.' };
  },
};
```

2. L'inscrire dans `packages/providers/src/registry.ts`.

C'est tout : l'adapter apparaît dans le catalogue, ses modèles dans les
sélecteurs, le routeur le prend en compte. Règles :

- traduire les erreurs avec `fromStatus` / `ProviderError` (le worker décide
  du retry avec `retryable`) ;
- remonter la progression par `ctx.onProgress` et l'identifiant externe par
  `ctx.onExternalId` ;
- respecter `ctx.signal` (annulation) — `http()` et `poll()` le font ;
- renvoyer les fichiers en `Buffer` : le stockage est l'affaire du studio.
