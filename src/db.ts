// ---------------------------------------------------------------------------
// SafeClaw — IndexedDB database layer
// ---------------------------------------------------------------------------

import { DB_NAME, DB_VERSION, LEGACY_DB_NAME } from './config.js';
import type { StoredMessage, Task, ConfigEntry, Session, ConversationMessage } from './types.js';

let db: IDBDatabase | null = null;

/**
 * Migrate data from the legacy 'openbrowserclaw' database to 'safeclaw'.
 */
async function migrateFromLegacyDb(): Promise<void> {
  const databases = await indexedDB.databases?.() || [];
  const legacyExists = databases.some((d: any) => d.name === LEGACY_DB_NAME);
  if (!legacyExists) return;

  const newExists = databases.some((d: any) => d.name === DB_NAME);
  if (newExists) {
    try { indexedDB.deleteDatabase(LEGACY_DB_NAME); } catch { /* empty */ }
    return;
  }

  console.log(`[SafeClaw] Migrating database from '${LEGACY_DB_NAME}' to '${DB_NAME}'...`);

  const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const newDb = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains('messages')) {
        const msgStore = database.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by-group-time', ['groupId', 'timestamp']);
        msgStore.createIndex('by-group', 'groupId');
      }
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'groupId' });
      }
      if (!database.objectStoreNames.contains('tasks')) {
        const taskStore = database.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('by-group', 'groupId');
        taskStore.createIndex('by-enabled', 'enabled');
      }
      if (!database.objectStoreNames.contains('config')) {
        database.createObjectStore('config', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const storeNames = ['messages', 'sessions', 'tasks', 'config'];
  for (const storeName of storeNames) {
    if (!legacyDb.objectStoreNames.contains(storeName)) continue;
    const items = await new Promise<any[]>((resolve, reject) => {
      const tx = legacyDb.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (items.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = newDb.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of items) store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  legacyDb.close();
  newDb.close();
  try { indexedDB.deleteDatabase(LEGACY_DB_NAME); } catch { /* empty */ }
  console.log('[SafeClaw] Database migration complete.');
}

/**
 * Open (or create) the IndexedDB database.
 */
export async function openDatabase(): Promise<IDBDatabase> {
  try { await migrateFromLegacyDb(); } catch (err) {
    console.warn('[SafeClaw] DB migration failed (non-fatal):', err);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      // Messages store
      if (!database.objectStoreNames.contains('messages')) {
        const msgStore = database.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by-group-time', ['groupId', 'timestamp']);
        msgStore.createIndex('by-group', 'groupId');
      }

      // Sessions store (conversation state per group)
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'groupId' });
      }

      // Tasks store (scheduled tasks)
      if (!database.objectStoreNames.contains('tasks')) {
        const taskStore = database.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('by-group', 'groupId');
        taskStore.createIndex('by-enabled', 'enabled');
      }

      // Config store (key-value)
      if (!database.objectStoreNames.contains('config')) {
        database.createObjectStore('config', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };
  });
}

function getDb(): IDBDatabase {
  if (!db) throw new Error('Database not initialized. Call openDatabase() first.');
  return db;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function txPromise<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txPromiseAll<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>[],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const requests = fn(store);
    const results: T[] = new Array(requests.length);
    let completed = 0;
    for (let i = 0; i < requests.length; i++) {
      requests[i].onsuccess = () => {
        results[i] = requests[i].result;
        if (++completed === requests.length) resolve(results);
      };
      requests[i].onerror = () => reject(requests[i].error);
    }
    if (requests.length === 0) resolve([]);
  });
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function saveMessage(msg: StoredMessage): Promise<void> {
  return txPromise('messages', 'readwrite', (store) =>
    store.put(msg),
  ).then(() => undefined);
}

export function getRecentMessages(
  groupId: string,
  limit: number,
): Promise<StoredMessage[]> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('by-group-time');
    const range = IDBKeyRange.bound([groupId, 0], [groupId, Infinity]);
    const request = index.openCursor(range, 'prev');
    const results: StoredMessage[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        // Reverse so oldest first
        resolve(results.reverse());
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export function getMessageCount(groupId: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('by-group');
    const request = index.count(groupId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getAllGroupIds(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('by-group');
    const request = index.openKeyCursor(null, 'nextunique');
    const ids: string[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        ids.push(cursor.key as string);
        cursor.continue();
      } else {
        resolve(ids);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function getSession(groupId: string): Promise<Session | undefined> {
  return txPromise('sessions', 'readonly', (store) =>
    store.get(groupId),
  );
}

export function saveSession(session: Session): Promise<void> {
  return txPromise('sessions', 'readwrite', (store) =>
    store.put(session),
  ).then(() => undefined);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function saveTask(task: Task): Promise<void> {
  // Store `enabled` as 0/1 so the IndexedDB 'by-enabled' index works
  // (IDB exact-match key queries don't equate boolean true with number 1).
  const record = { ...task, enabled: task.enabled ? 1 : 0 };
  return txPromise('tasks', 'readwrite', (store) =>
    store.put(record),
  ).then(() => undefined);
}

export function deleteTask(id: string): Promise<void> {
  return txPromise('tasks', 'readwrite', (store) =>
    store.delete(id),
  ).then(() => undefined);
}

export function getEnabledTasks(): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction('tasks', 'readonly');
    const store = tx.objectStore('tasks');
    const index = store.index('by-enabled');
    const request = index.getAll(1); // enabled = true (stored as 1 via saveTask)
    request.onsuccess = () => {
      // Convert numeric `enabled` back to boolean for the rest of the app
      const tasks = (request.result as any[]).map((t) => ({ ...t, enabled: true }));
      resolve(tasks);
    };
    request.onerror = () => reject(request.error);
  });
}

export function getAllTasks(): Promise<Task[]> {
  return txPromise('tasks', 'readonly', (store) =>
    store.getAll(),
  ).then((tasks: any[]) =>
    tasks.map((t) => ({ ...t, enabled: !!t.enabled })),
  );
}

export function updateTaskLastRun(id: string, timestamp: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const task = getReq.result as Task | undefined;
      if (!task) { resolve(); return; }
      task.lastRun = timestamp;
      const putReq = store.put(task);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function getConfig(key: string): Promise<string | undefined> {
  return txPromise('config', 'readonly', (store) =>
    store.get(key),
  ).then((entry: ConfigEntry | undefined) => entry?.value);
}

export function setConfig(key: string, value: string): Promise<void> {
  return txPromise('config', 'readwrite', (store) =>
    store.put({ key, value } as ConfigEntry),
  ).then(() => undefined);
}

export function deleteConfig(key: string): Promise<void> {
  return txPromise('config', 'readwrite', (store) =>
    store.delete(key),
  ).then(() => undefined);
}

export function getAllConfig(): Promise<ConfigEntry[]> {
  return txPromise('config', 'readonly', (store) =>
    store.getAll(),
  );
}

/**
 * Delete all messages for a given group.
 */
export function clearGroupMessages(groupId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = getDb().transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('by-group');
    const request = index.openCursor(groupId);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Build conversation messages for Claude API from stored messages
// ---------------------------------------------------------------------------

export async function buildConversationMessages(
  groupId: string,
  limit: number,
): Promise<ConversationMessage[]> {
  const messages = await getRecentMessages(groupId, limit);
  return messages.map((m) => ({
    role: m.isFromMe ? ('assistant' as const) : ('user' as const),
    content: m.isFromMe ? m.content : `${m.sender}: ${m.content}`,
  }));
}
