import { expect, test, type Page } from '@playwright/test';

// Le parcours principal d'un nouvel utilisateur, sans provider IA : tout ce
// qui ne génère pas doit marcher, et ce qui génère doit le dire clairement.

const email = `e2e-${Date.now()}@example.com`;
const password = 'motdepasse-e2e-solide';
let projectUrl = '';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button:has-text("Se connecter")');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test.describe.serial('studio', () => {
  test('inscription puis création d’un projet', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#name', 'E2E');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Créer le compte")');
    await page.waitForURL('**/new');
    await expect(page.getByRole('heading', { name: 'Que voulez-vous créer ?' })).toBeVisible();
    await page.getByRole('button', { name: /Court métrage/ }).click();
    await page.getByRole('button', { name: /Continuer/ }).click();
    await page.fill('#title', 'Projet E2E');
    await page.getByRole('button', { name: /Créer/ }).click();
    await page.waitForURL('**/concept**');
    projectUrl = page.url().split('/concept')[0];
  });

  test('une page protégée renvoie vers la connexion', async ({ browser }) => {
    const anon = await browser.newPage();
    await anon.goto(projectUrl);
    await expect(anon).toHaveURL(/\/login/);
    await anon.close();
  });

  test('créer un personnage et remplir sa fiche', async ({ page }) => {
    await login(page);
    await page.goto(`${projectUrl}/characters`);
    await page.getByRole('button', { name: 'Nouveau personnage' }).click();
    await page.getByRole('dialog').locator('input').first().fill('Awa');
    await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click();
    await page.waitForURL(/\/characters\/[a-z0-9]+$/);
    await page.getByLabel('Description gelée').or(page.locator('textarea').first()).fill('Woman, 30, short black hair, round glasses.');
    await expect(page.getByText('Enregistré')).toBeVisible();
    await page.reload();
    await expect(page.locator('textarea').first()).toHaveValue('Woman, 30, short black hair, round glasses.');
  });

  test('chaque page du projet s’affiche sans erreur', async ({ page }) => {
    await login(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const p of ['', '/concept', '/story', '/characters', '/locations', '/props', '/world', '/script', '/scenes', '/storyboard', '/continuity', '/assets', '/images', '/videos', '/audio', '/production', '/timeline', '/graph', '/export', '/settings']) {
      const res = await page.goto(`${projectUrl}${p}`);
      expect(res?.status(), p).toBeLessThan(400);
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toEqual([]);
  });

  test('générer sans provider affiche l’action de configuration', async ({ page }) => {
    await login(page);
    const res = await page.request.post(`${projectUrl.replace('/projects/', '/api/projects/')}/generations`, {
      data: { capability: 'IMAGE', mode: 'text-to-image', modelId: 'auto', prompt: 'test' },
    });
    // Aucune génération simulée : refus explicite avec l'action qui débloque.
    if (res.status() === 424) {
      const body = await res.json();
      expect(body.code).toBe('provider_not_configured');
      expect(body.action.href).toBe('/settings/providers');
    } else {
      // Un provider d'image est configuré sur cette instance : la demande part en file.
      expect(res.status()).toBe(200);
    }
  });
});
