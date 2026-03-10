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
    await expect(page.locator('text=Latest news')).toBeVisible();
    await expect(page.locator('text=Generate a report')).toBeVisible();
    await expect(page.locator('text=Map viewer')).toBeVisible();
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
});
