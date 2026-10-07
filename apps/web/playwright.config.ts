import { defineConfig } from '@playwright/test';

// Parcours navigateur contre un serveur déjà lancé (`pnpm dev`) avec ses
// services (`pnpm services`). E2E_BASE_URL pour viser une autre instance.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
});
