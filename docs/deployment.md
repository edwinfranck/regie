# Déploiement

régie se déploie en deux processus sans état — **web** (Next.js) et
**worker** (BullMQ) — autour de trois services : PostgreSQL, Redis, un
stockage S3.

## Docker Compose

```sh
cp .env.example .env    # renseigner AUTH_SECRET, ENCRYPTION_KEY, APP_URL…
docker compose --profile app up -d --build
```

Services : `postgres`, `redis`, `minio` (fork maintenu `pgsty/minio` : MinIO
ne publie plus d'images officielles), `web` (port 3000), `worker` (applique
les migrations au démarrage, puis consomme la file). Le bucket est créé au
premier usage.

## Séparément

| Composant | Commande | Notes |
|---|---|---|
| Migrations | `pnpm db:deploy` | à chaque version, avant de démarrer web et worker |
| Web | image `apps/web/Dockerfile` (sortie `standalone`), ou `pnpm build && pnpm --filter @regie/web start` | derrière un proxy TLS ; ne pas couper le buffering SSE (`X-Accel-Buffering: no` est envoyé) |
| Worker | image `apps/worker/Dockerfile`, ou `pnpm --filter @regie/worker start` | autant d'instances que nécessaire ; `WORKER_CONCURRENCY` par instance |

## Services managés

- **PostgreSQL** : n'importe quel Postgres 15+ (Neon, Supabase, RDS…) via
  `DATABASE_URL`.
- **Redis** : Redis 7 avec `maxmemory-policy noeviction` (exigence BullMQ) ;
  Upstash en mode TCP convient.
- **Stockage** :
  - AWS S3 : `S3_ENDPOINT` vide ou `https://s3.<région>.amazonaws.com`,
    `S3_FORCE_PATH_STYLE=false` ;
  - Cloudflare R2 : `S3_ENDPOINT=https://<compte>.r2.cloudflarestorage.com`,
    `S3_REGION=auto` ;
  - Supabase Storage : endpoint S3 du projet, clés S3 générées dans le
    tableau de bord ;
  - `S3_PUBLIC_URL` (domaine public du bucket) seulement si vous utilisez un
    provider qui exige des URLs publiques pour les images d'entrée (Luma). Le
    bucket reste sinon privé : l'application sert des URLs signées.

## Authentification

- `AUTH_SECRET` : secret de signature des sessions.
- Google : `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, URL de rappel
  `<APP_URL>/api/auth/callback/google`.
- GitHub : `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, rappel
  `<APP_URL>/api/auth/callback/github`.
- Le premier compte créé est administrateur ; `ADMIN_EMAILS` en désigne
  d'autres.

## Secrets

`ENCRYPTION_KEY` chiffre les clés des providers en base. La perdre rend ces
clés illisibles (il faudra les ressaisir) ; la changer impose de les
ressaisir aussi. À stocker dans le gestionnaire de secrets de l'hébergeur,
jamais dans le dépôt.

## Santé

`GET /api/health` → `{ ok, db, queue }`, 503 si la base ou Redis ne répond
pas. Les erreurs de génération et le journal d'audit sont visibles dans
**Administration**.
