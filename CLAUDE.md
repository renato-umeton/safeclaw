# CLAUDE.md — Agent Guide for SafeClaw

This file orients AI agents contributing to SafeClaw. Read it before writing any code.

## Project Overview

SafeClaw is a browser-native personal AI assistant. Zero server infrastructure — the browser is the server. It uses React, TypeScript, Vite, TailwindCSS/DaisyUI, and Zustand for state management.

## Repository Layout

```
src/
  orchestrator.ts        # State machine, message routing, agent invocation
  agent-worker.ts        # Web Worker: LLM provider tool-use loop
  types.ts               # Shared TypeScript types
  config.ts              # Configuration constants and trigger patterns
  db.ts                  # IndexedDB layer (messages, sessions, tasks, config)
  storage.ts             # OPFS (Origin Private File System) helpers
  shell.ts               # Lightweight bash emulator over OPFS
  crypto.ts              # AES-256-GCM encryption for API keys
  tools.ts               # Tool definitions for the LLM API
  router.ts              # Message router (browser/telegram channels)
  task-scheduler.ts      # Cron expression evaluation & scheduling
  providers/             # LLM provider abstraction layer
    router.ts            # Quality-first provider routing
    anthropic.ts         # Anthropic Claude API
    gemini.ts            # Google Gemini API
    webllm.ts            # WebLLM (local Qwen3 via WebGPU)
    chrome-ai.ts         # Chrome built-in AI (Gemini Nano)
  channels/              # Message channels (browser-chat, telegram)
  components/            # React UI components
  stores/                # Zustand state stores
  version-check.ts       # Semver bump detection & release doc enforcement
tests/
  setup.ts               # Global test setup (polyfills, mocks)
  helpers.ts             # Shared test helpers (mock OPFS, etc.)
  **/*.test.{ts,tsx}     # Test files mirror src/ structure
scripts/
  check-version-docs.sh  # CI script: enforces doc updates on minor/major bumps
```

## Commands

```bash
npm run dev            # Start Vite dev server (localhost:5173)
npm run build          # TypeScript check + production build
npm run typecheck      # TypeScript type checking only
npm run test           # Run full test suite (vitest run)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

## Test-Driven Development (Mandatory)

Every contribution must follow TDD. Write tests first, then implement.

### Testing Stack

- **Framework**: Vitest 4 with `happy-dom` environment
- **React testing**: `@testing-library/react` + `@testing-library/user-event`
- **Assertions**: Vitest globals (`describe`, `it`, `expect`, `vi`) + `@testing-library/jest-dom` matchers
- **IndexedDB**: `fake-indexeddb` (auto-polyfilled in `tests/setup.ts`)
- **OPFS**: Custom in-memory mock (see `tests/helpers.ts`)
- **Process isolation**: Tests run in forked processes (`pool: 'forks'`)

### Coverage Requirements

All four metrics must stay above **90%**:

```
lines:      90%
branches:   90%
functions:  90%
statements: 90%
```

These thresholds are enforced in `vitest.config.ts` — the coverage check will fail if any metric drops below 90%. Run `npm run test:coverage` to verify before submitting.

### Test File Conventions

- Test files live in `tests/` and mirror the `src/` directory structure.
- File naming: `tests/<path>/<module>.test.ts` (or `.test.tsx` for components).
- Example: `src/crypto.ts` → `tests/crypto.test.ts`, `src/providers/router.ts` → `tests/providers/router.test.ts`.

### Writing Tests — Patterns from This Codebase

**Unit test for a pure module** (e.g., `tests/crypto.test.ts`):

```ts
import { encryptValue, decryptValue } from '../src/crypto';

describe('crypto', () => {
  describe('encrypt/decrypt round-trip', () => {
    it('encrypts and decrypts a simple string', async () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = await encryptValue(plaintext);
      expect(encrypted).not.toBe(plaintext);
      const decrypted = await decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('error handling', () => {
    it('throws on decrypting corrupt data', async () => {
      await encryptValue('seed'); // ensure key exists
      const badData = btoa('not valid ciphertext');
      await expect(decryptValue(badData)).rejects.toThrow();
    });
  });
});
```

**Test with mocks** (e.g., `tests/providers/router.test.ts`):

```ts
vi.mock('../../src/providers/chrome-ai', () => ({
  ChromeAIProvider: class {
    id = 'chrome-ai' as const;
    isAvailable = async () => false;
    // ... minimal mock
  },
}));

describe('ProviderRegistry', () => {
  it('creates providers from API keys', () => {
    const registry = new ProviderRegistry({ anthropic: 'key1' });
    expect(registry.has('anthropic')).toBe(true);
  });
});
```

**React component test** (uses `@testing-library/react`):

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('renders the component and responds to interaction', async () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Clicked')).toBeInTheDocument();
});
```

### What to Test

- All public functions and exports
- Happy paths and edge cases (empty inputs, unicode, large data)
- Error handling (invalid inputs, corrupt data, network failures)
- State transitions (for stateful modules like the orchestrator)
- Component rendering and user interactions (for React components)

## Code Style

- TypeScript strict mode. No `any` unless unavoidable.
- ES modules (`import`/`export`), not CommonJS.
- Functional style preferred; classes used for provider implementations.
- Use existing patterns from the codebase — read neighboring files before writing new code.

## Release Documentation (Mandatory)

Minor and major version bumps require updates to **all four** of these files to reflect the new code and functionalities being released:

- `CLAUDE.md`
- `CONTRIBUTING.md`
- `README.md`
- `docs/website/index.html`

Patch releases (bug fixes only) do not require documentation updates.

This is enforced by the `Version Docs Check` GitHub Actions workflow (`.github/workflows/version-docs.yml`), which runs `scripts/check-version-docs.sh` on every PR to `main`. The check compares `package.json` version against `origin/main` and fails the PR if any required doc file is missing from the diff.

You can run the check locally before pushing:

```bash
bash scripts/check-version-docs.sh main
```

## Pull Request Checklist

1. Tests written **before** implementation (TDD)
2. `npm run test` passes
3. `npm run test:coverage` shows all metrics >= 90%
4. `npm run typecheck` passes
5. No new `any` types without justification
6. If minor/major version bump: all four release doc files updated (see above)
