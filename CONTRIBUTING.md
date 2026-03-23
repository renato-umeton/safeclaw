# Contributing to SafeClaw

Thank you for contributing to SafeClaw! This guide covers the expectations and workflow for all contributors — human and AI alike.

## Getting Started

The hosted app is available at [app-safeclaw.umeton.com](https://app-safeclaw.umeton.com). To contribute, clone the repo and run locally:

```bash
git clone https://github.com/renato-umeton/safeclaw.git
cd safeclaw
npm install
npm run dev          # Start dev server at localhost:5173
npm run test         # Run the unit test suite
npm run test:coverage # Verify coverage thresholds
npm run test:e2e     # Run Playwright E2E tests
```

## Test-Driven Development (TDD) — Required

**TDD is mandatory for all contributions.** Every pull request must include tests (both unit and E2E), and those tests should be written before the implementation code.

### The TDD Workflow

1. **Write a failing test** that describes the behavior you want to add or fix.
2. **Run the test** — confirm it fails for the right reason (`npm run test`).
3. **Write the minimal implementation** to make the test pass.
4. **Refactor** if needed, keeping tests green.
5. **Verify coverage** with `npm run test:coverage`.
6. **Write E2E tests** for user-facing features (`npm run test:e2e`).

### Coverage Requirement: >90%

SafeClaw enforces **90% minimum coverage** across all four metrics:

| Metric     | Threshold |
|------------|-----------|
| Lines      | 90%       |
| Branches   | 90%       |
| Functions  | 90%       |
| Statements | 90%       |

These thresholds are configured in `vitest.config.ts` and enforced automatically. If your changes drop any metric below 90%, the coverage check will fail and your PR cannot be merged.

Run coverage locally before pushing:

```bash
npm run test:coverage
```

### Testing Framework

SafeClaw uses **Vitest** for unit tests and **Playwright** for E2E tests.

#### Unit Tests (Vitest)

- **`@testing-library/react`** + **`@testing-library/user-event`** for React component tests
- **`@testing-library/jest-dom`** for DOM assertion matchers (e.g., `toBeInTheDocument()`)
- **`fake-indexeddb`** for IndexedDB polyfill in tests
- **`happy-dom`** as the DOM environment

Test globals (`describe`, `it`, `expect`, `vi`) are available without imports (configured via `vitest.config.ts`).

#### E2E Tests (Playwright)

- **`@playwright/test`** for browser-based end-to-end tests
- Tests run against Chromium (configured in `playwright.config.ts`)
- The Vite dev server starts automatically when running E2E tests
- E2E tests live in the `e2e/` directory with `*.spec.ts` naming

### Test File Structure

Unit tests live in the `tests/` directory and mirror the `src/` structure. E2E tests live in the `e2e/` directory:

```
# Unit tests
src/crypto.ts                    → tests/crypto.test.ts
src/providers/router.ts          → tests/providers/router.test.ts
src/components/chat/ChatPage.tsx → tests/components/chat/ChatPage.test.tsx

# E2E tests
e2e/app.spec.ts                  — App boot & navigation
e2e/chat.spec.ts                 — Chat page interactions
e2e/settings.spec.ts             — Settings page interactions
e2e/pages.spec.ts                — Other pages rendering
```

### Examples from the Codebase

**Example 1: Testing a utility module** (`tests/crypto.test.ts`)

This test verifies the encrypt/decrypt round-trip, edge cases, and error handling:

```ts
import { encryptValue, decryptValue } from '../src/crypto';

describe('crypto', () => {
  it('encrypts and decrypts a simple string', async () => {
    const plaintext = 'my-secret-api-key-12345';
    const encrypted = await encryptValue(plaintext);
    expect(encrypted).not.toBe(plaintext);
    const decrypted = await decryptValue(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same input (random IV)', async () => {
    const enc1 = await encryptValue('same-text');
    const enc2 = await encryptValue('same-text');
    expect(enc1).not.toBe(enc2);
  });

  it('throws on decrypting corrupt data', async () => {
    await encryptValue('seed');
    const badData = btoa('not valid ciphertext');
    await expect(decryptValue(badData)).rejects.toThrow();
  });
});
```

**Example 2: Testing with mocks** (`tests/providers/router.test.ts`)

When a dependency needs to be replaced, use `vi.mock()`:

```ts
vi.mock('../../src/providers/chrome-ai', () => ({
  ChromeAIProvider: class {
    id = 'chrome-ai' as const;
    name = 'Chrome AI (Gemini Nano)';
    isLocal = true;
    supportsToolUse = () => false;
    isAvailable = async () => false;
    getContextLimit = () => 4096;
    chat = vi.fn();
  },
}));

describe('ProviderRegistry', () => {
  it('creates providers from API keys', () => {
    const registry = new ProviderRegistry({ anthropic: 'key1', gemini: 'key2' });
    expect(registry.has('anthropic')).toBe(true);
    expect(registry.has('gemini')).toBe(true);
  });

  it('skips providers without API keys', () => {
    const registry = new ProviderRegistry({});
    expect(registry.has('anthropic')).toBe(false);
  });
});
```

**Example 3: Testing a React component** (`tests/components/chat/ChatInput.test.tsx`)

Component tests use `@testing-library/react` to render and interact:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('renders the input and handles submission', async () => {
  const onSend = vi.fn();
  render(<ChatInput onSend={onSend} />);

  const input = screen.getByRole('textbox');
  await userEvent.type(input, 'Hello');
  await userEvent.keyboard('{Enter}');

  expect(onSend).toHaveBeenCalledWith('Hello');
});
```

**Example 4: E2E test** (`e2e/settings.spec.ts`)

E2E tests use Playwright to interact with the real app in a browser:

```ts
import { test, expect } from '@playwright/test';

test('renders all settings sections', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForSelector('text=Settings', { timeout: 10_000 });

  await expect(page.locator('text=Appearance')).toBeVisible();
  await expect(page.locator('text=LLM Provider')).toBeVisible();
  await expect(page.locator('text=API Keys')).toBeVisible();
});
```

### What to Cover

#### Unit Tests
- **Happy paths**: Normal usage with expected inputs
- **Edge cases**: Empty strings, unicode, very large inputs, boundary values
- **Error handling**: Invalid inputs, corrupt data, missing dependencies
- **State transitions**: For stateful modules (orchestrator, stores)
- **User interactions**: Click, type, keyboard events for components

#### E2E Tests
- **App boot**: Loading state, initialization, redirect to settings/chat
- **Navigation**: All page routes accessible via tabs
- **Settings**: Theme changes, provider selection, API key inputs
- **Chat**: Prompt starters, chat input, message sending
- **Page rendering**: Every route renders its expected content

## Code Style

- **TypeScript** in strict mode. Avoid `any` unless absolutely necessary.
- **ES modules** (`import`/`export`), not CommonJS.
- Follow existing patterns — read the neighboring source files before writing new code.
- Keep changes focused. Don't refactor unrelated code in the same PR.

## Library Acknowledgements — Required for New Dependencies

Every third-party library added as a dependency (production or dev) **must** be acknowledged at the end of the existing acknowledgements list in all three locations:

1. **`src/components/settings/AcknowledgementsSection.tsx`** — in-app Settings card
2. **`README.md`** — Acknowledgements section
3. **`docs/website/index.html`** — website footer attribution

Add new entries at the end of the current package list, before the closing period. Include the library name and a link to its homepage or repository. If the npm package name differs from the display name, add a parenthetical (e.g., "PDF.js (pdfjs-dist)").

## Pull Request Checklist

Before submitting your PR, verify:

- [ ] Tests written **before** implementation (TDD) — both unit and E2E
- [ ] `npm run test` — all unit tests pass
- [ ] `npm run test:coverage` — all metrics >= 90%
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] `npm run typecheck` — no type errors
- [ ] No new `any` types without justification in a comment
- [ ] Changes are focused and minimal — no unrelated refactors
- [ ] If new dependencies added: acknowledged in all three acknowledgement locations (see above)

## Releases

SafeClaw uses a GitHub Actions workflow to automate releases. You don't need to build and upload artifacts manually.

**How it works:**

1. Update the version in `package.json`
2. Commit the change and push to `dev`
3. Create and push a version tag:

```bash
git tag v2.1.0
git push origin v2.1.0
```

The CI workflow will automatically:
- Run the full test suite with coverage
- Build the production bundle (`npm run build`)
- Zip the `dist/` output
- Create a GitHub Release with the zip attached

The release asset is then downloadable at:
```
https://github.com/renato-umeton/safeclaw/releases/download/v2.1.0/safeclaw-2.1.0.zip
```

**Do not commit build artifacts** (zips, dist folders) to the repository. Binary files belong in GitHub Releases.

## Example Workflows

SafeClaw showcases curated example workflows on the website and in the README, sourced from [awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases). When adding new examples, keep descriptions concise (one sentence) and ensure proper attribution to the source repository.

## Reporting Issues

Open an issue on GitHub with:
- Steps to reproduce
- Expected vs actual behavior
- Browser version (SafeClaw targets Chrome)

## Questions?

Open a discussion or issue on the [SafeClaw repository](https://github.com/renato-umeton/safeclaw).
