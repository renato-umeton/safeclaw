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
});

test.describe('Skill Hub page', () => {
  test('renders the skill hub page', async ({ page }) => {
    await page.goto('/skill-hub');
    await page.waitForSelector('.navbar', { timeout: 10_000 });
    await expect(page.locator('.tabs >> text=Skills')).toBeVisible();
  });
});
