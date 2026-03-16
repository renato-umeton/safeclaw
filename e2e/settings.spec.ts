import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// SafeClaw — E2E: Settings page
// ---------------------------------------------------------------------------

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForSelector('h2:has-text("Settings")', { timeout: 10_000 });
  });

  test('renders all settings sections', async ({ page }) => {
    await expect(page.locator('.card-title', { hasText: 'Appearance' })).toBeVisible();
    await expect(page.locator('.card-title', { hasText: 'AI Provider' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Local Models' })).toBeVisible();
    await expect(page.locator('.card-title', { hasText: 'Assistant Name' })).toBeVisible();
    await expect(page.locator('.card-title', { hasText: 'Telegram Bot' })).toBeVisible();
    await expect(page.locator('.card-title', { hasText: 'Storage' })).toBeVisible();
  });

  test('renders semantic group headings', async ({ page }) => {
    await expect(page.locator('text=AI & Models')).toBeVisible();
    await expect(page.locator('text=Personalization')).toBeVisible();
    await expect(page.locator('text=Integrations')).toBeVisible();
    await expect(page.locator('text=Storage & System')).toBeVisible();
  });

  test('theme selector has system/light/dark options', async ({ page }) => {
    const themeSelect = page.locator('select').filter({ hasText: 'System' }).first();
    await expect(themeSelect).toBeVisible();

    const options = themeSelect.locator('option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText('System');
    await expect(options.nth(1)).toHaveText('Light');
    await expect(options.nth(2)).toHaveText('Dark');
  });

  test('can change theme selection', async ({ page }) => {
    const themeSelect = page.locator('select').filter({ hasText: 'System' }).first();
    await themeSelect.selectOption('light');
    await expect(themeSelect).toHaveValue('light');

    await themeSelect.selectOption('dark');
    await expect(themeSelect).toHaveValue('dark');
  });

  test('provider selector lists all providers', async ({ page }) => {
    const providerSelect = page.locator('select').filter({ hasText: 'Anthropic Claude' }).first();
    await expect(providerSelect).toBeVisible();

    const options = providerSelect.locator('option');
    await expect(options).toHaveCount(4);
  });

  test('Anthropic API key input accepts text', async ({ page }) => {
    const keyInput = page.locator('input[placeholder="sk-ant-..."]');
    await expect(keyInput).toBeVisible();
    await expect(keyInput).toHaveAttribute('type', 'password');

    await keyInput.fill('sk-ant-test-key-12345');
    await expect(keyInput).toHaveValue('sk-ant-test-key-12345');
  });

  test('API key visibility toggle works', async ({ page }) => {
    const keyInput = page.locator('input[placeholder="sk-ant-..."]');
    await expect(keyInput).toHaveAttribute('type', 'password');

    // Click the eye toggle button (the btn-ghost next to the input)
    const toggleBtn = keyInput.locator('..').locator('button.btn-ghost');
    await toggleBtn.click();

    await expect(keyInput).toHaveAttribute('type', 'text');
  });

  test('save button is disabled when API key is empty', async ({ page }) => {
    // Find the save button in the Anthropic key section
    const anthropicSection = page.locator('fieldset').filter({ hasText: 'Anthropic API Key' });
    const saveBtn = anthropicSection.locator('button', { hasText: 'Save' });
    await expect(saveBtn).toBeDisabled();
  });

  test('assistant name input is editable', async ({ page }) => {
    const nameInput = page.locator('input[placeholder="Andy"]');
    await expect(nameInput).toBeVisible();

    await nameInput.clear();
    await nameInput.fill('TestBot');
    await expect(nameInput).toHaveValue('TestBot');
  });

  test('storage section shows breakdown labels', async ({ page }) => {
    await expect(page.locator('text=Model weights')).toBeVisible();
    await expect(page.locator('text=Other data')).toBeVisible();
  });

  // --- CV Upload E2E tests ---

  test('profile section has CV upload button', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Upload CV' })).toBeVisible();
  });

  test('CV file input accepts pdf, docx, txt, and md formats', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', '.txt,.md,.pdf,.docx');
  });

  test('uploading a text CV populates the resume textarea', async ({ page }) => {
    const cvContent = 'Senior developer with Python and JavaScript experience';
    const fileInput = page.locator('input[type="file"]');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Playwright requires Node Buffer at runtime
    const buffer = (globalThis as any).Buffer.from(cvContent) as Uint8Array;
    await fileInput.setInputFiles({
      name: 'my_resume.txt',
      mimeType: 'text/plain',
      buffer,
    });

    const textarea = page.locator('textarea');
    await expect(textarea).toHaveValue(cvContent);
    await expect(page.locator('text=my_resume.txt')).toBeVisible();
  });
});
