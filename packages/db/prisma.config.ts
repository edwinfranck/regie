import 'dotenv/config';
import { config as load } from 'dotenv';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Le .env vit à la racine du monorepo.
load({ path: path.resolve(import.meta.dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx src/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
