import { encryptValue, decryptValue, migrateKeystore } from '../src/crypto';

describe('crypto', () => {
  describe('encrypt/decrypt round-trip', () => {
    it('encrypts and decrypts a simple string', async () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = await encryptValue(plaintext);
      expect(encrypted).not.toBe(plaintext);
      const decrypted = await decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts an empty string', async () => {
      const encrypted = await encryptValue('');
      const decrypted = await decryptValue(encrypted);
      expect(decrypted).toBe('');
    });

    it('encrypts and decrypts unicode text', async () => {
      const plaintext = 'Hello 世界 🌍';
      const encrypted = await encryptValue(plaintext);
      const decrypted = await decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', async () => {
      const plaintext = 'same-text';
      const enc1 = await encryptValue(plaintext);
      const enc2 = await encryptValue(plaintext);
      expect(enc1).not.toBe(enc2);
    });

    it('encrypted value is base64 encoded', async () => {
      const encrypted = await encryptValue('test');
      // Should be valid base64
      expect(() => atob(encrypted)).not.toThrow();
    });

    it('encrypts and decrypts a long string', async () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = await encryptValue(plaintext);
      const decrypted = await decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts special characters', async () => {
      const plaintext = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`\n\t\r';
      const encrypted = await encryptValue(plaintext);
      const decrypted = await decryptValue(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypted output contains IV + ciphertext (minimum size)', async () => {
      const encrypted = await encryptValue('x');
      const decoded = atob(encrypted);
      // IV is 12 bytes, ciphertext is at least the plaintext + GCM tag (16 bytes)
      expect(decoded.length).toBeGreaterThanOrEqual(12 + 1 + 16);
    });
  });

  describe('key generation and persistence', () => {
    it('uses the same key across multiple encrypt/decrypt calls', async () => {
      // Encrypt with the key that gets created on first call
      const encrypted1 = await encryptValue('test1');
      const encrypted2 = await encryptValue('test2');

      // Both should decrypt correctly (using same stored key)
      expect(await decryptValue(encrypted1)).toBe('test1');
      expect(await decryptValue(encrypted2)).toBe('test2');
    });
  });

  describe('error handling', () => {
    it('throws on decrypting corrupt base64 data', async () => {
      // First encrypt something to ensure key exists
      await encryptValue('seed');

      // Tamper with ciphertext - use valid base64 but wrong data
      const badData = btoa('this is not a valid ciphertext at all!!');
      await expect(decryptValue(badData)).rejects.toThrow();
    });

    it('throws on decrypting truncated data', async () => {
      await encryptValue('seed');

      // Too short to contain IV + ciphertext
      const tooShort = btoa('short');
      await expect(decryptValue(tooShort)).rejects.toThrow();
    });
  });

  describe('migrateKeystore', () => {
    beforeEach(async () => {
      // Clean up any leftover databases from previous tests
      indexedDB.deleteDatabase('obc-keystore');
      indexedDB.deleteDatabase('sc-keystore');
      // Wait a tick for deletions to process
      await new Promise((r) => setTimeout(r, 0));
    });

    it('completes without error when no legacy DB exists', async () => {
      await expect(migrateKeystore()).resolves.toBeUndefined();
    });

    it('can be called multiple times without error', async () => {
      await migrateKeystore();
      await migrateKeystore();
      // Should not throw on repeated calls
    });

    it('returns early and attempts to delete legacy when both DBs exist', async () => {
      // Create both legacy and new databases
      const legacyReq = indexedDB.open('obc-keystore', 1);
      await new Promise<void>((resolve, reject) => {
        legacyReq.onupgradeneeded = () => {
          legacyReq.result.createObjectStore('keys');
        };
        legacyReq.onsuccess = () => { legacyReq.result.close(); resolve(); };
        legacyReq.onerror = () => reject(legacyReq.error);
      });

      const newReq = indexedDB.open('sc-keystore', 1);
      await new Promise<void>((resolve, reject) => {
        newReq.onupgradeneeded = () => {
          newReq.result.createObjectStore('keys');
        };
        newReq.onsuccess = () => { newReq.result.close(); resolve(); };
        newReq.onerror = () => reject(newReq.error);
      });

      // Should not log migration messages (returns early on line 29)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await migrateKeystore();
      expect(consoleSpy).not.toHaveBeenCalledWith('[SafeClaw] Migrating keystore...');
      consoleSpy.mockRestore();
    });

    it('migrates key from legacy DB to new DB when only legacy exists', async () => {
      // Create legacy database with a CryptoKey
      const legacyReq = indexedDB.open('obc-keystore', 1);
      const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        legacyReq.onupgradeneeded = () => {
          legacyReq.result.createObjectStore('keys');
        };
        legacyReq.onsuccess = () => resolve(legacyReq.result);
        legacyReq.onerror = () => reject(legacyReq.error);
      });

      // Generate a key and store it in legacy DB
      const testKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      await new Promise<void>((resolve, reject) => {
        const tx = legacyDb.transaction('keys', 'readwrite');
        tx.objectStore('keys').put(testKey, 'api-key-encryption');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      legacyDb.close();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await migrateKeystore();

      // Verify migration log messages
      expect(consoleSpy).toHaveBeenCalledWith('[SafeClaw] Migrating keystore...');
      expect(consoleSpy).toHaveBeenCalledWith('[SafeClaw] Keystore migration complete.');
      consoleSpy.mockRestore();

      // Verify the key exists in new DB
      const newReq = indexedDB.open('sc-keystore', 1);
      const newDb = await new Promise<IDBDatabase>((resolve, reject) => {
        newReq.onsuccess = () => resolve(newReq.result);
        newReq.onerror = () => reject(newReq.error);
      });

      const migratedKey = await new Promise<CryptoKey | undefined>((resolve, reject) => {
        const tx = newDb.transaction('keys', 'readonly');
        const req = tx.objectStore('keys').get('api-key-encryption');
        req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
        req.onerror = () => reject(req.error);
      });
      newDb.close();

      expect(migratedKey).toBeDefined();
    });

    it('handles legacy DB with no key (empty store)', async () => {
      // Create legacy database with the store but no key
      const legacyReq = indexedDB.open('obc-keystore', 1);
      await new Promise<void>((resolve, reject) => {
        legacyReq.onupgradeneeded = () => {
          legacyReq.result.createObjectStore('keys');
        };
        legacyReq.onsuccess = () => { legacyReq.result.close(); resolve(); };
        legacyReq.onerror = () => reject(legacyReq.error);
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await migrateKeystore();

      // Should still log migration messages
      expect(consoleSpy).toHaveBeenCalledWith('[SafeClaw] Migrating keystore...');
      expect(consoleSpy).toHaveBeenCalledWith('[SafeClaw] Keystore migration complete.');
      consoleSpy.mockRestore();

      // No new DB should have been created (no key to migrate)
      // The code skips writing when existingKey is falsy
    });

    it('handles indexedDB.databases returning undefined', async () => {
      // Temporarily make indexedDB.databases return undefined to hit the || [] fallback
      const origDatabases = indexedDB.databases;
      (indexedDB as any).databases = undefined;

      // Should complete without error, treating it as no legacy DB
      await expect(migrateKeystore()).resolves.toBeUndefined();

      // Restore
      indexedDB.databases = origDatabases;
    });

    it('migrated key can be used for encryption/decryption', async () => {
      // Create legacy database with a key, migrate, then use the key
      const legacyReq = indexedDB.open('obc-keystore', 1);
      const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        legacyReq.onupgradeneeded = () => {
          legacyReq.result.createObjectStore('keys');
        };
        legacyReq.onsuccess = () => resolve(legacyReq.result);
        legacyReq.onerror = () => reject(legacyReq.error);
      });

      const testKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      await new Promise<void>((resolve, reject) => {
        const tx = legacyDb.transaction('keys', 'readwrite');
        tx.objectStore('keys').put(testKey, 'api-key-encryption');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      legacyDb.close();

      vi.spyOn(console, 'log').mockImplementation(() => {});
      await migrateKeystore();
      vi.restoreAllMocks();

      // Now encrypt/decrypt should work using the migrated key
      const encrypted = await encryptValue('migrated-secret');
      const decrypted = await decryptValue(encrypted);
      expect(decrypted).toBe('migrated-secret');
    });
  });
});
