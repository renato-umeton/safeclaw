// ---------------------------------------------------------------------------
// SafeClaw — OPFS (Origin Private File System) helpers
// ---------------------------------------------------------------------------

import { OPFS_ROOT, LEGACY_OPFS_ROOT } from './config.js';

/**
 * Migrate OPFS data from legacy 'openbrowserclaw' root to 'safeclaw' root.
 * Recursively copies all files, then removes the legacy root.
 */
export async function migrateFromLegacyOpfs(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();

    // Check if legacy root exists
    let legacyDir: FileSystemDirectoryHandle;
    try {
      legacyDir = await root.getDirectoryHandle(LEGACY_OPFS_ROOT);
    } catch {
      return; // No legacy root — nothing to migrate
    }

    // Check if new root already exists
    try {
      await root.getDirectoryHandle(OPFS_ROOT);
      // New root exists — just clean up legacy
      await root.removeEntry(LEGACY_OPFS_ROOT, { recursive: true });
      return;
    } catch {
      // New root doesn't exist — proceed with migration
    }

    console.log(`[SafeClaw] Migrating OPFS from '${LEGACY_OPFS_ROOT}' to '${OPFS_ROOT}'...`);

    const newDir = await root.getDirectoryHandle(OPFS_ROOT, { create: true });
    await copyDir(legacyDir, newDir);
    await root.removeEntry(LEGACY_OPFS_ROOT, { recursive: true });

    console.log('[SafeClaw] OPFS migration complete.');
  } catch (err) {
    console.warn('[SafeClaw] OPFS migration failed (non-fatal):', err);
  }
}

async function copyDir(src: FileSystemDirectoryHandle, dst: FileSystemDirectoryHandle): Promise<void> {
  for await (const [name, handle] of src.entries()) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      const content = await file.text();
      const newFile = await dst.getFileHandle(name, { create: true });
      const writable = await newFile.createWritable();
      await writable.write(content);
      await writable.close();
    } else {
      const srcSub = await src.getDirectoryHandle(name);
      const dstSub = await dst.getDirectoryHandle(name, { create: true });
      await copyDir(srcSub, dstSub);
    }
  }
}

/**
 * Get a handle to a nested directory, creating intermediate dirs.
 */
async function getNestedDir(
  root: FileSystemDirectoryHandle,
  ...segments: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const seg of segments) {
    current = await current.getDirectoryHandle(seg, { create: true });
  }
  return current;
}

/**
 * Get the group workspace directory.
 */
async function getGroupDir(groupId: string): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  // Sanitize groupId for filesystem: replace colons with dashes
  const safeId = groupId.replace(/:/g, '-');
  return getNestedDir(root, OPFS_ROOT, 'groups', safeId);
}

/**
 * Get the workspace subdirectory for a group.
 */
async function getWorkspaceDir(groupId: string): Promise<FileSystemDirectoryHandle> {
  const groupDir = await getGroupDir(groupId);
  return groupDir.getDirectoryHandle('workspace', { create: true });
}

/**
 * Parse a path into directory segments and filename.
 */
function parsePath(filePath: string): { dirs: string[]; filename: string } {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) throw new Error('Empty file path');
  const filename = parts.pop()!;
  return { dirs: parts, filename };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a file from a group's workspace.
 */
export async function readGroupFile(
  groupId: string,
  filePath: string,
): Promise<string> {
  const groupDir = await getGroupDir(groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return file.text();
}

/**
 * Write content to a file in a group's workspace.
 * Creates intermediate directories as needed.
 */
export async function writeGroupFile(
  groupId: string,
  filePath: string,
  content: string,
): Promise<void> {
  const groupDir = await getGroupDir(groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }

  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * List files and directories in a group's workspace directory.
 */
export async function listGroupFiles(
  groupId: string,
  dirPath: string = '.',
): Promise<string[]> {
  const groupDir = await getGroupDir(groupId);

  let dir = groupDir;
  if (dirPath && dirPath !== '.') {
    const parts = dirPath.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean);
    for (const seg of parts) {
      dir = await dir.getDirectoryHandle(seg);
    }
  }

  const entries: string[] = [];
  for await (const [name, handle] of dir.entries()) {
    entries.push(handle.kind === 'directory' ? `${name}/` : name);
  }
  return entries.sort();
}

/**
 * Delete a file from a group's workspace.
 */
export async function deleteGroupFile(
  groupId: string,
  filePath: string,
): Promise<void> {
  const groupDir = await getGroupDir(groupId);
  const { dirs, filename } = parsePath(filePath);

  let dir = groupDir;
  for (const seg of dirs) {
    dir = await dir.getDirectoryHandle(seg);
  }

  await dir.removeEntry(filename);
}

/**
 * Check if a file exists in a group's workspace.
 */
export async function groupFileExists(
  groupId: string,
  filePath: string,
): Promise<boolean> {
  try {
    await readGroupFile(groupId, filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Request persistent storage so the browser doesn't evict our data.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist();
  }
  return false;
}

/**
 * Get storage usage estimate.
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}

/**
 * Estimate storage used by WebLLM model weight caches.
 * WebLLM stores models in the Cache Storage API with cache names
 * containing "webllm" or "mlc".
 */
export async function getModelCacheEstimate(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  try {
    const keys = await caches.keys();
    const modelCaches = keys.filter(
      (k) => k.toLowerCase().includes('webllm') || k.toLowerCase().includes('mlc'),
    );
    let totalSize = 0;
    for (const cacheName of modelCaches) {
      const cache = await caches.open(cacheName);
      const cacheKeys = await cache.keys();
      for (const req of cacheKeys) {
        const resp = await cache.match(req);
        if (resp) {
          const blob = await resp.blob();
          totalSize += blob.size;
        }
      }
    }
    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Delete all WebLLM model weight caches to reclaim storage.
 * Models will be re-downloaded on next use.
 */
export async function deleteModelCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  const modelCaches = keys.filter(
    (k) => k.toLowerCase().includes('webllm') || k.toLowerCase().includes('mlc'),
  );
  for (const cacheName of modelCaches) {
    await caches.delete(cacheName);
  }
}

/** Info about a single cached model */
export interface ModelCacheInfo {
  cacheName: string;
  size: number;
}

/**
 * List individual WebLLM/MLC model caches with their sizes.
 * Returns one entry per cache (each cache typically corresponds to one model).
 */
export async function listModelCaches(): Promise<ModelCacheInfo[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const keys = await caches.keys();
    const modelCacheNames = keys.filter(
      (k) => k.toLowerCase().includes('webllm') || k.toLowerCase().includes('mlc'),
    );
    const results: ModelCacheInfo[] = [];
    for (const cacheName of modelCacheNames) {
      const cache = await caches.open(cacheName);
      const cacheKeys = await cache.keys();
      let size = 0;
      for (const req of cacheKeys) {
        const resp = await cache.match(req);
        if (resp) {
          const blob = await resp.blob();
          size += blob.size;
        }
      }
      results.push({ cacheName, size });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Delete a single model cache by name.
 */
export async function deleteModelCache(cacheName: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(cacheName);
}
