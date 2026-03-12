import {
  readGroupFile,
  writeGroupFile,
  listGroupFiles,
  deleteGroupFile,
  groupFileExists,
  requestPersistentStorage,
  getStorageEstimate,
  migrateFromLegacyOpfs,
  getModelCacheEstimate,
  deleteModelCaches,
} from '../src/storage';

const GROUP = 'br:test-storage';

describe('storage (OPFS)', () => {
  describe('write and read', () => {
    it('writes and reads a file', async () => {
      await writeGroupFile(GROUP, 'test.txt', 'hello world');
      const content = await readGroupFile(GROUP, 'test.txt');
      expect(content).toBe('hello world');
    });

    it('creates intermediate directories', async () => {
      await writeGroupFile(GROUP, 'deep/nested/dir/file.txt', 'nested content');
      const content = await readGroupFile(GROUP, 'deep/nested/dir/file.txt');
      expect(content).toBe('nested content');
    });

    it('overwrites existing files', async () => {
      await writeGroupFile(GROUP, 'overwrite.txt', 'first');
      await writeGroupFile(GROUP, 'overwrite.txt', 'second');
      const content = await readGroupFile(GROUP, 'overwrite.txt');
      expect(content).toBe('second');
    });

    it('throws on reading non-existent file', async () => {
      await expect(readGroupFile(GROUP, 'nonexistent.txt')).rejects.toThrow();
    });

    it('handles empty file content', async () => {
      await writeGroupFile(GROUP, 'empty.txt', '');
      const content = await readGroupFile(GROUP, 'empty.txt');
      expect(content).toBe('');
    });

    it('handles file with special characters in content', async () => {
      const special = 'line1\nline2\ttab\r\nwindows\n';
      await writeGroupFile(GROUP, 'special.txt', special);
      const content = await readGroupFile(GROUP, 'special.txt');
      expect(content).toBe(special);
    });

    it('reads file from nested path', async () => {
      await writeGroupFile(GROUP, 'a/b/c/deep.txt', 'deep');
      const content = await readGroupFile(GROUP, 'a/b/c/deep.txt');
      expect(content).toBe('deep');
    });

    it('throws on reading from non-existent directory', async () => {
      await expect(readGroupFile(GROUP, 'no-such-dir/file.txt')).rejects.toThrow();
    });
  });

  describe('listGroupFiles', () => {
    it('lists files in a directory', async () => {
      await writeGroupFile(GROUP, 'a.txt', 'a');
      await writeGroupFile(GROUP, 'b.txt', 'b');
      const files = await listGroupFiles(GROUP);
      expect(files).toContain('a.txt');
      expect(files).toContain('b.txt');
    });

    it('marks directories with trailing /', async () => {
      await writeGroupFile(GROUP, 'subdir/file.txt', 'content');
      const entries = await listGroupFiles(GROUP);
      expect(entries.some(e => e.endsWith('/'))).toBe(true);
    });

    it('returns sorted entries', async () => {
      await writeGroupFile(GROUP, 'c.txt', 'c');
      await writeGroupFile(GROUP, 'a.txt', 'a');
      await writeGroupFile(GROUP, 'b.txt', 'b');
      const entries = await listGroupFiles(GROUP);
      const sorted = [...entries].sort();
      expect(entries).toEqual(sorted);
    });

    it('lists with "." as dirPath (default)', async () => {
      await writeGroupFile(GROUP, 'root.txt', 'data');
      const entries = await listGroupFiles(GROUP, '.');
      expect(entries).toContain('root.txt');
    });

    it('lists empty directory', async () => {
      // Group dir is freshly created — empty except what we add
      const entries = await listGroupFiles(GROUP);
      expect(Array.isArray(entries)).toBe(true);
    });

    it('throws when listing non-existent subdirectory', async () => {
      await expect(listGroupFiles(GROUP, 'nosuchdir')).rejects.toThrow();
    });
  });

  describe('deleteGroupFile', () => {
    it('deletes a file', async () => {
      await writeGroupFile(GROUP, 'todelete.txt', 'data');
      await deleteGroupFile(GROUP, 'todelete.txt');
      await expect(readGroupFile(GROUP, 'todelete.txt')).rejects.toThrow();
    });

    it('throws when deleting non-existent file', async () => {
      await expect(deleteGroupFile(GROUP, 'nonexistent.txt')).rejects.toThrow();
    });

    it('deletes file in subdirectory', async () => {
      await writeGroupFile(GROUP, 'dir/file.txt', 'data');
      await deleteGroupFile(GROUP, 'dir/file.txt');
      await expect(readGroupFile(GROUP, 'dir/file.txt')).rejects.toThrow();
    });

    it('file does not exist after deletion', async () => {
      await writeGroupFile(GROUP, 'check.txt', 'data');
      expect(await groupFileExists(GROUP, 'check.txt')).toBe(true);
      await deleteGroupFile(GROUP, 'check.txt');
      expect(await groupFileExists(GROUP, 'check.txt')).toBe(false);
    });
  });

  describe('groupFileExists', () => {
    it('returns true for existing files', async () => {
      await writeGroupFile(GROUP, 'exists.txt', 'data');
      expect(await groupFileExists(GROUP, 'exists.txt')).toBe(true);
    });

    it('returns false for non-existent files', async () => {
      expect(await groupFileExists(GROUP, 'nope.txt')).toBe(false);
    });

    it('returns false for file in non-existent directory', async () => {
      expect(await groupFileExists(GROUP, 'nodir/nofile.txt')).toBe(false);
    });

    it('returns true for nested file', async () => {
      await writeGroupFile(GROUP, 'x/y/z.txt', 'data');
      expect(await groupFileExists(GROUP, 'x/y/z.txt')).toBe(true);
    });
  });

  describe('listGroupFiles with subdirectory', () => {
    it('lists files in a subdirectory', async () => {
      await writeGroupFile(GROUP, 'sub/file1.txt', 'a');
      await writeGroupFile(GROUP, 'sub/file2.txt', 'b');
      const files = await listGroupFiles(GROUP, 'sub');
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.txt');
    });

    it('lists nested subdirectory path', async () => {
      await writeGroupFile(GROUP, 'a/b/file.txt', 'data');
      const files = await listGroupFiles(GROUP, 'a/b');
      expect(files).toContain('file.txt');
    });
  });

  describe('directory operations', () => {
    it('handles groupId with colons (sanitized to dashes)', async () => {
      const colonGroup = 'tg:12345';
      await writeGroupFile(colonGroup, 'test.txt', 'data');
      const content = await readGroupFile(colonGroup, 'test.txt');
      expect(content).toBe('data');
    });

    it('multiple groups have isolated storage', async () => {
      const group1 = 'br:group1';
      const group2 = 'br:group2';
      await writeGroupFile(group1, 'shared.txt', 'group1 data');
      await writeGroupFile(group2, 'shared.txt', 'group2 data');

      expect(await readGroupFile(group1, 'shared.txt')).toBe('group1 data');
      expect(await readGroupFile(group2, 'shared.txt')).toBe('group2 data');
    });

    it('handles path with leading slash', async () => {
      await writeGroupFile(GROUP, '/leadingslash.txt', 'data');
      const content = await readGroupFile(GROUP, '/leadingslash.txt');
      expect(content).toBe('data');
    });

    it('handles path with backslashes (normalized)', async () => {
      await writeGroupFile(GROUP, 'dir\\file.txt', 'data');
      const content = await readGroupFile(GROUP, 'dir/file.txt');
      expect(content).toBe('data');
    });

    it('throws on empty file path', async () => {
      await expect(writeGroupFile(GROUP, '', 'data')).rejects.toThrow('Empty file path');
    });

    it('throws on path with only slashes', async () => {
      await expect(readGroupFile(GROUP, '/')).rejects.toThrow('Empty file path');
    });

    it('handles listing with empty string dirPath', async () => {
      await writeGroupFile(GROUP, 'file.txt', 'data');
      const entries = await listGroupFiles(GROUP, '');
      expect(entries).toContain('file.txt');
    });
  });

  describe('requestPersistentStorage', () => {
    it('returns a boolean', async () => {
      const result = await requestPersistentStorage();
      expect(typeof result).toBe('boolean');
    });

    it('returns true when persist is available (mocked)', async () => {
      const result = await requestPersistentStorage();
      expect(result).toBe(true);
    });

    it('returns false when navigator.storage.persist is unavailable', async () => {
      const origStorage = navigator.storage;
      Object.defineProperty(navigator, 'storage', {
        value: { getDirectory: origStorage.getDirectory },
        writable: true,
        configurable: true,
      });
      const result = await requestPersistentStorage();
      expect(result).toBe(false);
      Object.defineProperty(navigator, 'storage', {
        value: origStorage,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('getStorageEstimate', () => {
    it('returns usage and quota', async () => {
      const estimate = await getStorageEstimate();
      expect(estimate).toHaveProperty('usage');
      expect(estimate).toHaveProperty('quota');
      expect(typeof estimate.usage).toBe('number');
    });

    it('returns numeric values', async () => {
      const estimate = await getStorageEstimate();
      expect(typeof estimate.usage).toBe('number');
      expect(typeof estimate.quota).toBe('number');
      expect(estimate.usage).toBeGreaterThanOrEqual(0);
      expect(estimate.quota).toBeGreaterThanOrEqual(0);
    });

    it('returns zeros when navigator.storage.estimate is unavailable', async () => {
      const origStorage = navigator.storage;
      Object.defineProperty(navigator, 'storage', {
        value: { getDirectory: origStorage.getDirectory, persist: origStorage.persist },
        writable: true,
        configurable: true,
      });
      const estimate = await getStorageEstimate();
      expect(estimate).toEqual({ usage: 0, quota: 0 });
      Object.defineProperty(navigator, 'storage', {
        value: origStorage,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('migrateFromLegacyOpfs', () => {
    it('completes without error when no legacy root exists', async () => {
      await expect(migrateFromLegacyOpfs()).resolves.toBeUndefined();
    });

    it('can be called multiple times without error', async () => {
      await migrateFromLegacyOpfs();
      await migrateFromLegacyOpfs();
    });

    it('cleans up legacy root when new root already exists', async () => {
      // Set up: create both legacy and new root directories
      const root = await navigator.storage.getDirectory();
      const legacyDir = await root.getDirectoryHandle('openbrowserclaw', { create: true });
      const legacyFile = await legacyDir.getFileHandle('test.txt', { create: true });
      const writable = await legacyFile.createWritable();
      await writable.write('legacy data');
      await writable.close();

      await root.getDirectoryHandle('safeclaw', { create: true });

      await migrateFromLegacyOpfs();

      // Legacy root should be removed
      await expect(root.getDirectoryHandle('openbrowserclaw')).rejects.toThrow();
    });

    it('migrates files from legacy root to new root', async () => {
      // Set up: create legacy root with a file but no new root
      const root = await navigator.storage.getDirectory();
      const legacyDir = await root.getDirectoryHandle('openbrowserclaw', { create: true });
      const legacyFile = await legacyDir.getFileHandle('migrated.txt', { create: true });
      const writable = await legacyFile.createWritable();
      await writable.write('migrated content');
      await writable.close();

      await migrateFromLegacyOpfs();

      // New root should exist with migrated file
      const newDir = await root.getDirectoryHandle('safeclaw');
      const newFile = await newDir.getFileHandle('migrated.txt');
      const file = await newFile.getFile();
      const content = await file.text();
      expect(content).toBe('migrated content');

      // Legacy root should be removed
      await expect(root.getDirectoryHandle('openbrowserclaw')).rejects.toThrow();
    });

    it('migrates nested directories from legacy root', async () => {
      const root = await navigator.storage.getDirectory();
      const legacyDir = await root.getDirectoryHandle('openbrowserclaw', { create: true });
      const subDir = await legacyDir.getDirectoryHandle('subdir', { create: true });
      const file = await subDir.getFileHandle('nested.txt', { create: true });
      const writable = await file.createWritable();
      await writable.write('nested data');
      await writable.close();

      await migrateFromLegacyOpfs();

      const newDir = await root.getDirectoryHandle('safeclaw');
      const newSub = await newDir.getDirectoryHandle('subdir');
      const newFile = await newSub.getFileHandle('nested.txt');
      const f = await newFile.getFile();
      expect(await f.text()).toBe('nested data');
    });

    it('handles migration failure gracefully', async () => {
      // Temporarily break navigator.storage.getDirectory to trigger the outer catch
      const origStorage = navigator.storage;
      Object.defineProperty(navigator, 'storage', {
        value: {
          ...origStorage,
          getDirectory: () => Promise.reject(new Error('OPFS unavailable')),
        },
        writable: true,
        configurable: true,
      });

      // Should not throw — error is caught and logged
      await expect(migrateFromLegacyOpfs()).resolves.toBeUndefined();

      Object.defineProperty(navigator, 'storage', {
        value: origStorage,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('getModelCacheEstimate', () => {
    // In-memory CacheStorage polyfill for happy-dom
    let mockCacheStore: Map<string, Map<string, Response>>;
    let origCaches: typeof globalThis.caches;

    beforeEach(() => {
      origCaches = globalThis.caches;
      mockCacheStore = new Map();
      const mockCaches = {
        open: async (name: string) => {
          if (!mockCacheStore.has(name)) mockCacheStore.set(name, new Map());
          const store = mockCacheStore.get(name)!;
          return {
            put: async (req: Request | string, resp: Response) => {
              const url = typeof req === 'string' ? req : req.url;
              store.set(url, resp.clone());
            },
            keys: async () => [...store.keys()].map((u) => new Request(u)),
            match: async (req: Request) => store.get(req.url)?.clone() ?? undefined,
          };
        },
        keys: async () => [...mockCacheStore.keys()],
        delete: async (name: string) => {
          const had = mockCacheStore.has(name);
          mockCacheStore.delete(name);
          return had;
        },
      } as unknown as CacheStorage;
      Object.defineProperty(globalThis, 'caches', { value: mockCaches, writable: true, configurable: true });
    });

    afterEach(() => {
      if (origCaches !== undefined) {
        Object.defineProperty(globalThis, 'caches', { value: origCaches, writable: true, configurable: true });
      } else {
        // @ts-expect-error — restore undefined
        delete globalThis.caches;
      }
    });

    it('returns 0 when caches API is undefined', async () => {
      // @ts-expect-error — removing caches for testing
      delete globalThis.caches;
      const result = await getModelCacheEstimate();
      expect(result).toBe(0);
    });

    it('returns 0 when no webllm/mlc caches exist', async () => {
      const result = await getModelCacheEstimate();
      expect(result).toBe(0);
    });

    it('estimates size of webllm caches', async () => {
      const cache = await caches.open('webllm-test-cache');
      await cache.put(
        new Request('https://example.com/model.bin'),
        new Response('x'.repeat(1024)),
      );
      const estimate = await getModelCacheEstimate();
      expect(estimate).toBeGreaterThanOrEqual(1024);
    });

    it('estimates size of mlc caches', async () => {
      const cache = await caches.open('mlc-model-cache');
      await cache.put(
        new Request('https://example.com/weights.bin'),
        new Response('y'.repeat(512)),
      );
      const estimate = await getModelCacheEstimate();
      expect(estimate).toBeGreaterThanOrEqual(512);
    });

    it('ignores non-model caches', async () => {
      const cache = await caches.open('my-app-cache');
      await cache.put(
        new Request('https://example.com/app.js'),
        new Response('z'.repeat(2048)),
      );
      const estimate = await getModelCacheEstimate();
      expect(estimate).toBe(0);
    });
  });

  describe('deleteModelCaches', () => {
    let mockCacheStore: Map<string, Map<string, Response>>;
    let origCaches: typeof globalThis.caches;

    beforeEach(() => {
      origCaches = globalThis.caches;
      mockCacheStore = new Map();
      const mockCaches = {
        open: async (name: string) => {
          if (!mockCacheStore.has(name)) mockCacheStore.set(name, new Map());
          return {};
        },
        keys: async () => [...mockCacheStore.keys()],
        delete: async (name: string) => {
          const had = mockCacheStore.has(name);
          mockCacheStore.delete(name);
          return had;
        },
      } as unknown as CacheStorage;
      Object.defineProperty(globalThis, 'caches', { value: mockCaches, writable: true, configurable: true });
    });

    afterEach(() => {
      if (origCaches !== undefined) {
        Object.defineProperty(globalThis, 'caches', { value: origCaches, writable: true, configurable: true });
      } else {
        // @ts-expect-error — restore undefined
        delete globalThis.caches;
      }
    });

    it('does nothing when caches API is undefined', async () => {
      // @ts-expect-error — removing caches for testing
      delete globalThis.caches;
      await expect(deleteModelCaches()).resolves.toBeUndefined();
    });

    it('deletes webllm caches', async () => {
      await caches.open('webllm-model-weights');
      const keysBefore = await caches.keys();
      expect(keysBefore).toContain('webllm-model-weights');

      await deleteModelCaches();

      const keysAfter = await caches.keys();
      expect(keysAfter).not.toContain('webllm-model-weights');
    });

    it('deletes mlc caches', async () => {
      await caches.open('mlc-engine-cache');
      await deleteModelCaches();
      const keys = await caches.keys();
      expect(keys).not.toContain('mlc-engine-cache');
    });

    it('preserves non-model caches', async () => {
      await caches.open('app-static-cache');
      await caches.open('webllm-to-delete');

      await deleteModelCaches();

      const keys = await caches.keys();
      expect(keys).toContain('app-static-cache');
      expect(keys).not.toContain('webllm-to-delete');
    });
  });
});
