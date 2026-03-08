import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
// @ts-expect-error Node crypto types not available in browser TS config
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto API
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
  });
}

// Mock navigator.storage.getDirectory (OPFS)
import { mockOPFS } from './helpers';

const storageMock = {
  getDirectory: () => Promise.resolve(mockOPFS.root()),
  persist: () => Promise.resolve(true),
  estimate: () => Promise.resolve({ usage: 1024, quota: 1073741824 }),
};

Object.defineProperty(navigator, 'storage', {
  value: storageMock,
  writable: true,
  configurable: true,
});

// Mock Worker constructor
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);
}

vi.stubGlobal('Worker', MockWorker);

// Mock import.meta.url
if (typeof import.meta.url === 'undefined') {
  Object.defineProperty(import.meta, 'url', {
    value: 'file:///test/',
    writable: true,
  });
}

// Mock AudioContext
class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  close = vi.fn();
}

vi.stubGlobal('AudioContext', MockAudioContext);

// Reset OPFS state between tests
beforeEach(() => {
  mockOPFS.reset();
});
