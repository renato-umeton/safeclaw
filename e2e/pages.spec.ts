import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// SafeClaw — E2E: Other pages render correctly
// ---------------------------------------------------------------------------

test.describe('Files page', () => {
  test('renders the files page', async ({ page }) => {
    await page.goto('/files');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
    // The Files tab should be active
    await expect(page.locator('.tabs >> text=Files')).toBeVisible();
  });
});

test.describe('Tasks page', () => {
  test('renders the tasks page', async ({ page }) => {
    await page.goto('/tasks');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
    await expect(page.locator('.tabs >> text=Tasks')).toBeVisible();
  });
});

test.describe('Use Cases page', () => {
  test('renders the use cases page', async ({ page }) => {
    await page.goto('/use-cases');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
    await expect(page.locator('.tabs >> text=Use Cases')).toBeVisible();
  });

  test('opens detail modal when clicking a use case card', async ({ page }) => {
    await page.goto('/use-cases');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
    // Click the first use case card
    const firstCard = page.locator('.card[role="button"]').first();
    await firstCard.click();
    // Modal should appear
    await expect(page.locator('[data-testid="usecase-detail-modal"]')).toBeVisible();
    // Should have Start in Chat button
    await expect(page.locator('[data-testid="start-in-chat"]')).toBeVisible();
  });

  test('closes detail modal', async ({ page }) => {
    await page.goto('/use-cases');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
    const firstCard = page.locator('.card[role="button"]').first();
    await firstCard.click();
    await expect(page.locator('[data-testid="usecase-detail-modal"]')).toBeVisible();
    // Close via button
    await page.locator('button[aria-label="Close"]').click();
    await expect(page.locator('[data-testid="usecase-detail-modal"]')).not.toBeVisible();
  });
});

test.describe('Skill Hub page', () => {
  test('renders the skill hub page', async ({ page }) => {
    await page.goto('/skill-hub');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
    await expect(page.locator('.tabs >> text=Skills')).toBeVisible();
  });
});
