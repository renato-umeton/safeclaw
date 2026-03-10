import { defineConfig } from 'vitest/config';
import path from 'path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      './storage.js': path.resolve(__dirname, 'src/storage.ts'),
      './config.js': path.resolve(__dirname, 'src/config.ts'),
      './db.js': path.resolve(__dirname, 'src/db.ts'),
      './crypto.js': path.resolve(__dirname, 'src/crypto.ts'),
      './ulid.js': path.resolve(__dirname, 'src/ulid.ts'),
      './types.js': path.resolve(__dirname, 'src/types.ts'),
      './tools.js': path.resolve(__dirname, 'src/tools.ts'),
      './shell.js': path.resolve(__dirname, 'src/shell.ts'),
      './router.js': path.resolve(__dirname, 'src/router.ts'),
      './orchestrator.js': path.resolve(__dirname, 'src/orchestrator.ts'),
      './task-scheduler.js': path.resolve(__dirname, 'src/task-scheduler.ts'),
      './vm.js': path.resolve(__dirname, 'src/vm.ts'),
      './markdown.js': path.resolve(__dirname, 'src/markdown.ts'),
      './channels/browser-chat.js': path.resolve(__dirname, 'src/channels/browser-chat.ts'),
      './channels/telegram.js': path.resolve(__dirname, 'src/channels/telegram.ts'),
      './providers/types.js': path.resolve(__dirname, 'src/providers/types.ts'),
      './providers/anthropic.js': path.resolve(__dirname, 'src/providers/anthropic.ts'),
      './providers/gemini.js': path.resolve(__dirname, 'src/providers/gemini.ts'),
      './providers/webllm.js': path.resolve(__dirname, 'src/providers/webllm.ts'),
      './providers/chrome-ai.js': path.resolve(__dirname, 'src/providers/chrome-ai.ts'),
      './providers/router.js': path.resolve(__dirname, 'src/providers/router.ts'),
      './providers/index.js': path.resolve(__dirname, 'src/providers/index.ts'),
      '../types.js': path.resolve(__dirname, 'src/types.ts'),
      '../config.js': path.resolve(__dirname, 'src/config.ts'),
      '../storage.js': path.resolve(__dirname, 'src/storage.ts'),
      '../ulid.js': path.resolve(__dirname, 'src/ulid.ts'),
      '../db.js': path.resolve(__dirname, 'src/db.ts'),
      '../orchestrator.js': path.resolve(__dirname, 'src/orchestrator.ts'),
      './agent-worker.js': path.resolve(__dirname, 'src/agent-worker.ts'),
      '../../hooks/use-pwa-install.js': path.resolve(__dirname, 'src/hooks/use-pwa-install.ts'),
      '../../hooks/use-pwa-update.js': path.resolve(__dirname, 'src/hooks/use-pwa-update.ts'),
      '../pwa/InstallBanner.js': path.resolve(__dirname, 'src/components/pwa/InstallBanner.tsx'),
      '../pwa/UpdateToast.js': path.resolve(__dirname, 'src/components/pwa/UpdateToast.tsx'),
      './VersionSection.js': path.resolve(__dirname, 'src/components/settings/VersionSection.tsx'),
      '../../version-checker.js': path.resolve(__dirname, 'src/version-checker.ts'),
      './version-checker.js': path.resolve(__dirname, 'src/version-checker.ts'),
      'virtual:pwa-register': path.resolve(__dirname, 'tests/mocks/virtual-pwa-register.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    pool: 'forks',
    forks: {
      execArgv: ['--max-old-space-size=4096'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/types.ts',           // Type definitions only, no runtime code
        'src/providers/types.ts',  // Type definitions only
        'src/providers/index.ts',  // Re-export barrel file
        'src/vm.ts',              // WebVM integration, requires v86 runtime
        'src/agent-worker.ts',    // Web Worker, requires Worker thread context
        'src/App.tsx',            // Root app component with router setup
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
