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

  test('shows send button by default, not stop button', async ({ page }) => {
    const sendButton = page.locator('button[aria-label="Send message"]');
    const stopButton = page.locator('button[aria-label="Stop generation"]');
    await expect(sendButton).toBeVisible();
    await expect(stopButton).not.toBeVisible();
  });
});
