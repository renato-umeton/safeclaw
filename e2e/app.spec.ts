import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// SafeClaw — E2E: App shell & boot
// ---------------------------------------------------------------------------

test.describe('App boot', () => {
  test('loads the app and renders the layout', async ({ page }) => {
    await page.goto('/');
    // The app should render the SafeClaw branding in the navbar center
    await expect(page.locator('.navbar-center >> text=SafeClaw')).toBeVisible();
  });

  test('shows loading state while initializing', async ({ page }) => {
    // The #app element should contain content once React mounts
    await page.goto('/');
    // After boot the loading spinner is replaced by the layout
    await expect(page.locator('.navbar')).toBeVisible({ timeout: 10_000 });
  });

  test('redirects to settings when not configured', async ({ page }) => {
    await page.goto('/');
    // Without any API keys configured, the app should redirect to /settings
    await page.waitForURL('**/settings', { timeout: 10_000 });
    await expect(page.locator('h2', { hasText: 'Settings' })).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('can navigate to all pages via desktop tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForSelector('.navbar', { timeout: 10_000 });

    // Navigate to Chat
    await page.locator('.tabs >> text=Chat').click();
    await expect(page).toHaveURL(/\/chat/);

    // Navigate to Files
    await page.locator('.tabs >> text=Files').click();
    await expect(page).toHaveURL(/\/files/);

    // Navigate to Tasks
    await page.locator('.tabs >> text=Tasks').click();
    await expect(page).toHaveURL(/\/tasks/);

    // Navigate to Use Cases
    await page.locator('.tabs >> text=Use Cases').click();
    await expect(page).toHaveURL(/\/use-cases/);

    // Navigate to Skills
    await page.locator('.tabs >> text=Skills').click();
    await expect(page).toHaveURL(/\/skill-hub/);

    // Navigate to Settings
    await page.locator('.tabs >> text=Settings').click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('redirects unknown routes to /chat', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.waitForURL('**/{chat,settings}', { timeout: 10_000 });
  });
});
