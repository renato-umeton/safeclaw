import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// SafeClaw — E2E: Chat page
// ---------------------------------------------------------------------------

test.describe('Chat page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
  });

  test('shows prompt starters when no messages', async ({ page }) => {
    await expect(page.locator('text=Start a conversation')).toBeVisible();
    await expect(page.locator('text=Try one of these to get started')).toBeVisible();
  });

  test('displays all prompt starter cards', async ({ page }) => {
    await expect(page.locator('.font-medium', { hasText: 'Latest news' })).toBeVisible();
    await expect(page.locator('.font-medium', { hasText: 'Generate a report' })).toBeVisible();
    await expect(page.locator('.font-medium', { hasText: 'Map viewer' })).toBeVisible();
  });

  test('chat input is visible and enabled', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
  });

  test('can type in the chat input', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('Hello, SafeClaw!');
    await expect(textarea).toHaveValue('Hello, SafeClaw!');
  });

  test('model selector is visible in chat', async ({ page }) => {
    const modelSelect = page.locator('select[aria-label="Select AI model"]');
    await expect(modelSelect).toBeVisible();
  });

  test('model selector shows provider groups', async ({ page }) => {
    const modelSelect = page.locator('select[aria-label="Select AI model"]');
    const optgroups = modelSelect.locator('optgroup');
    await expect(optgroups).toHaveCount(4);
  });

  test('can change model in chat', async ({ page }) => {
    const modelSelect = page.locator('select[aria-label="Select AI model"]');
    await modelSelect.selectOption('gemini:gemini-2.0-flash');
    await expect(modelSelect).toHaveValue('gemini:gemini-2.0-flash');
  });
});
