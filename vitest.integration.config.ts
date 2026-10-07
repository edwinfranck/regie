import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Tests d'intégration : exigent Postgres, Redis et le stockage S3 lancés
// (`pnpm services`) et le fichier .env.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    // File dédiée : le worker de développement ne doit pas prendre les jobs des tests.
    env: { ...loadEnv(), REGIE_QUEUE: 'generations-test' },
  },
});

function loadEnv() {
  if (!existsSync('.env')) return {};
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}
