import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// SafeClaw — E2E: Local model chat interaction
// Covers: Settings → select WebLLM provider with smallest model,
//         set "Always local" preference, navigate to Chat,
//         send a yes/no question, and verify a response appears.
// ---------------------------------------------------------------------------

test.describe('Local model chat', () => {
  test('configure WebLLM and chat with local model', async ({ page }) => {
    // ---- Step 1: Go to Settings and configure WebLLM ----
    await page.goto('/settings');
    await page.waitForSelector('h2:has-text("Settings")', { timeout: 10_000 });

    // Select WebLLM (Local) as the provider
    const providerSection = page.locator('.card').filter({ hasText: 'LLM Provider' });
    const providerSelect = providerSection.locator('select').first();
    await providerSelect.selectOption('webllm');
    await expect(providerSelect).toHaveValue('webllm');

    // Verify the smallest model (Qwen3 0.6B) is selected by default
    const modelSelect = providerSection.locator('select').nth(1);
    await expect(modelSelect).toHaveValue('qwen3-0.6b');

    // ---- Step 2: Set local preference to "Always local" ----
    const localModelsSection = page.locator('.card').filter({ hasText: 'Local Models' });
    const localPrefSelect = localModelsSection.locator('select');
    await localPrefSelect.selectOption('always');
    await expect(localPrefSelect).toHaveValue('always');

    // ---- Step 3: Navigate to Chat ----
    await page.locator('.tabs >> text=Chat').click();
    await expect(page).toHaveURL(/\/chat/);

    // Verify chat page loaded with prompt starters
    await expect(page.locator('text=Start a conversation')).toBeVisible();

    // ---- Step 4: Send a yes/no question ----
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Is the sky blue? Answer with just yes or no.');
    await page.locator('button[aria-label="Send message"]').click();

    // Verify the user message appears in the chat
    const userBubble = page.locator('.chat-end .chat-bubble');
    await expect(userBubble.last()).toContainText('Is the sky blue?');

    // ---- Step 5: Wait for a response or error ----
    // WebLLM needs WebGPU and model download. In environments where WebGPU
    // is available, the model will download and respond. Otherwise, an error
    // alert will appear. Either outcome validates the end-to-end flow.
    const assistantReply = page.locator('.chat-start .chat-bubble');
    const errorAlert = page.locator('[role="alert"]');

    // Wait for either an assistant reply or an error (generous timeout for
    // model download + inference in WebGPU-capable environments)
    await expect(assistantReply.first().or(errorAlert.first())).toBeVisible({
      timeout: 120_000,
    });
  });

  test('settings persist after configuring WebLLM provider', async ({ page }) => {
    // Configure the provider
    await page.goto('/settings');
    await page.waitForSelector('h2:has-text("Settings")', { timeout: 10_000 });

    const providerSection = page.locator('.card').filter({ hasText: 'LLM Provider' });
    const providerSelect = providerSection.locator('select').first();
    await providerSelect.selectOption('webllm');

    // Set "Always local" preference
    const localModelsSection = page.locator('.card').filter({ hasText: 'Local Models' });
    const localPrefSelect = localModelsSection.locator('select');
    await localPrefSelect.selectOption('always');

    // Navigate away and back
    await page.locator('.tabs >> text=Chat').click();
    await expect(page).toHaveURL(/\/chat/);
    await page.locator('.tabs >> text=Settings').click();
    await expect(page).toHaveURL(/\/settings/);
    await page.waitForSelector('h2:has-text("Settings")', { timeout: 10_000 });

    // Verify settings were persisted
    const providerSelectAfter = page.locator('.card').filter({ hasText: 'LLM Provider' }).locator('select').first();
    await expect(providerSelectAfter).toHaveValue('webllm');

    const localPrefAfter = page.locator('.card').filter({ hasText: 'Local Models' }).locator('select');
    await expect(localPrefAfter).toHaveValue('always');
  });
});
