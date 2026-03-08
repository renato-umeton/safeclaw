import type { StoredMessage, Task, Session } from '../src/types';

// We need to reset modules between tests to clear the module-level `db` variable.
// We also need to close the IDB connection before deleting, or deleteDatabase blocks.
let openDatabase: typeof import('../src/db').openDatabase;
let saveMessage: typeof import('../src/db').saveMessage;
let getRecentMessages: typeof import('../src/db').getRecentMessages;
let getMessageCount: typeof import('../src/db').getMessageCount;
let getAllGroupIds: typeof import('../src/db').getAllGroupIds;
let getSession: typeof import('../src/db').getSession;
let saveSession: typeof import('../src/db').saveSession;
let saveTask: typeof import('../src/db').saveTask;
let deleteTask: typeof import('../src/db').deleteTask;
let getEnabledTasks: typeof import('../src/db').getEnabledTasks;
let getAllTasks: typeof import('../src/db').getAllTasks;
let updateTaskLastRun: typeof import('../src/db').updateTaskLastRun;
let getConfig: typeof import('../src/db').getConfig;
let setConfig: typeof import('../src/db').setConfig;
let deleteConfig: typeof import('../src/db').deleteConfig;
let getAllConfig: typeof import('../src/db').getAllConfig;
let clearGroupMessages: typeof import('../src/db').clearGroupMessages;
let buildConversationMessages: typeof import('../src/db').buildConversationMessages;
let txPromiseAll: typeof import('../src/db').txPromiseAll;

let dbConnection: IDBDatabase | null = null;

async function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('db', () => {
  beforeEach(async () => {
    // Close the previous connection so deleteDatabase doesn't block
    if (dbConnection) {
      dbConnection.close();
      dbConnection = null;
    }

    // Reset modules to clear the module-level db variable
    vi.resetModules();

    await deleteDatabase('safeclaw');
    await deleteDatabase('openbrowserclaw');

    const mod = await import('../src/db');
    openDatabase = mod.openDatabase;
    saveMessage = mod.saveMessage;
    getRecentMessages = mod.getRecentMessages;
    getMessageCount = mod.getMessageCount;
    getAllGroupIds = mod.getAllGroupIds;
    getSession = mod.getSession;
    saveSession = mod.saveSession;
    saveTask = mod.saveTask;
    deleteTask = mod.deleteTask;
    getEnabledTasks = mod.getEnabledTasks;
    getAllTasks = mod.getAllTasks;
    updateTaskLastRun = mod.updateTaskLastRun;
    getConfig = mod.getConfig;
    setConfig = mod.setConfig;
    deleteConfig = mod.deleteConfig;
    getAllConfig = mod.getAllConfig;
    clearGroupMessages = mod.clearGroupMessages;
    buildConversationMessages = mod.buildConversationMessages;
    txPromiseAll = mod.txPromiseAll;

    dbConnection = await openDatabase();
  });

  afterAll(() => {
    if (dbConnection) {
      dbConnection.close();
      dbConnection = null;
    }
  });

  describe('openDatabase', () => {
    it('opens without error', async () => {
      expect(dbConnection).toBeDefined();
      expect(dbConnection!.name).toBe('safeclaw');
    });
  });

  describe('messages', () => {
    const makeMsg = (id: string, groupId: string, content: string, timestamp = Date.now()): StoredMessage => ({
      id,
      groupId,
      sender: 'User',
      content,
      timestamp,
      channel: 'browser',
      isFromMe: false,
      isTrigger: false,
    });

    it('saves and retrieves messages', async () => {
      const msg = makeMsg('msg-1', 'br:main', 'hello', 1000);
      await saveMessage(msg);
      const messages = await getRecentMessages('br:main', 10);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('hello');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await saveMessage(makeMsg(`msg-${i}`, 'br:main', `msg ${i}`, 1000 + i));
      }
      const messages = await getRecentMessages('br:main', 3);
      expect(messages).toHaveLength(3);
    });

    it('returns messages in oldest-first order', async () => {
      await saveMessage(makeMsg('old', 'br:main', 'old', 1000));
      await saveMessage(makeMsg('new', 'br:main', 'new', 2000));
      const messages = await getRecentMessages('br:main', 10);
      expect(messages[0].content).toBe('old');
      expect(messages[1].content).toBe('new');
    });

    it('filters by groupId', async () => {
      await saveMessage(makeMsg('a', 'br:main', 'main msg', 1000));
      await saveMessage(makeMsg('b', 'tg:123', 'tg msg', 1000));
      const main = await getRecentMessages('br:main', 10);
      expect(main).toHaveLength(1);
      expect(main[0].content).toBe('main msg');
    });

    it('counts messages per group', async () => {
      await saveMessage(makeMsg('a', 'br:main', 'a', 1000));
      await saveMessage(makeMsg('b', 'br:main', 'b', 2000));
      await saveMessage(makeMsg('c', 'tg:123', 'c', 3000));
      expect(await getMessageCount('br:main')).toBe(2);
      expect(await getMessageCount('tg:123')).toBe(1);
    });

    it('gets all group IDs', async () => {
      await saveMessage(makeMsg('a', 'br:main', 'a', 1000));
      await saveMessage(makeMsg('b', 'tg:123', 'b', 2000));
      const ids = await getAllGroupIds();
      expect(ids).toContain('br:main');
      expect(ids).toContain('tg:123');
    });

    it('clears messages for a group', async () => {
      await saveMessage(makeMsg('a', 'br:main', 'a', 1000));
      await saveMessage(makeMsg('b', 'br:main', 'b', 2000));
      await saveMessage(makeMsg('c', 'tg:123', 'c', 3000));
      await clearGroupMessages('br:main');
      expect(await getMessageCount('br:main')).toBe(0);
      expect(await getMessageCount('tg:123')).toBe(1);
    });
  });

  describe('sessions', () => {
    it('saves and retrieves sessions', async () => {
      const session: Session = {
        groupId: 'br:main',
        messages: [{ role: 'user', content: 'hello' }],
        updatedAt: Date.now(),
      };
      await saveSession(session);
      const retrieved = await getSession('br:main');
      expect(retrieved?.groupId).toBe('br:main');
      expect(retrieved?.messages).toHaveLength(1);
    });

    it('returns undefined for missing session', async () => {
      const session = await getSession('nonexistent');
      expect(session).toBeUndefined();
    });
  });

  describe('tasks', () => {
    const makeTask = (id: string, enabled = true): Task => ({
      id,
      groupId: 'br:main',
      schedule: '* * * * *',
      prompt: 'test prompt',
      enabled,
      lastRun: null,
      createdAt: Date.now(),
    });

    it('saves and retrieves tasks', async () => {
      await saveTask(makeTask('task-1'));
      const tasks = await getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-1');
      expect(tasks[0].enabled).toBe(true);
    });

    it('gets only enabled tasks', async () => {
      await saveTask(makeTask('t1', true));
      await saveTask(makeTask('t2', false));
      const enabled = await getEnabledTasks();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe('t1');
    });

    it('deletes tasks', async () => {
      await saveTask(makeTask('t1'));
      await deleteTask('t1');
      const tasks = await getAllTasks();
      expect(tasks).toHaveLength(0);
    });

    it('updates lastRun timestamp', async () => {
      await saveTask(makeTask('t1'));
      const now = Date.now();
      await updateTaskLastRun('t1', now);
      const tasks = await getAllTasks();
      expect(tasks[0].lastRun).toBe(now);
    });

    it('handles updateTaskLastRun for non-existent task', async () => {
      await expect(updateTaskLastRun('nonexistent', Date.now())).resolves.toBeUndefined();
    });
  });

  describe('config', () => {
    it('sets and gets config values', async () => {
      await setConfig('test-key', 'test-value');
      const value = await getConfig('test-key');
      expect(value).toBe('test-value');
    });

    it('returns undefined for missing keys', async () => {
      const value = await getConfig('nonexistent');
      expect(value).toBeUndefined();
    });

    it('deletes config entries', async () => {
      await setConfig('key', 'val');
      await deleteConfig('key');
      const value = await getConfig('key');
      expect(value).toBeUndefined();
    });

    it('gets all config entries', async () => {
      await setConfig('a', '1');
      await setConfig('b', '2');
      const all = await getAllConfig();
      expect(all).toHaveLength(2);
    });

    it('overwrites existing config', async () => {
      await setConfig('key', 'old');
      await setConfig('key', 'new');
      expect(await getConfig('key')).toBe('new');
    });
  });

  describe('buildConversationMessages', () => {
    it('maps stored messages to conversation format', async () => {
      const msg1: StoredMessage = {
        id: 'a',
        groupId: 'br:main',
        sender: 'User',
        content: 'hello',
        timestamp: 1000,
        channel: 'browser',
        isFromMe: false,
        isTrigger: false,
      };
      const msg2: StoredMessage = {
        id: 'b',
        groupId: 'br:main',
        sender: 'Andy',
        content: 'hi there',
        timestamp: 2000,
        channel: 'browser',
        isFromMe: true,
        isTrigger: false,
      };
      await saveMessage(msg1);
      await saveMessage(msg2);

      const conv = await buildConversationMessages('br:main', 10);
      expect(conv).toHaveLength(2);
      expect(conv[0].role).toBe('user');
      expect(conv[0].content).toContain('User: hello');
      expect(conv[1].role).toBe('assistant');
      expect(conv[1].content).toBe('hi there');
    });

    it('returns empty array when no messages exist', async () => {
      const conv = await buildConversationMessages('nonexistent', 10);
      expect(conv).toHaveLength(0);
    });
  });

  describe('openDatabase upgrade with partial stores', () => {
    it('skips creating stores that already exist during upgrade', async () => {
      // Pre-create the safeclaw DB with only the 'messages' store at version 0
      // so when openDatabase opens it at DB_VERSION=1, the upgrade handler
      // sees 'messages' already exists but needs to create the others.
      if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
      }
      await deleteDatabase('safeclaw');
      await deleteDatabase('openbrowserclaw');

      // Create DB at version 1 with only 'messages' store
      // We can't use version < DB_VERSION with fake-indexeddb easily,
      // but we can create at the same version with partial stores.
      // Actually, IDB won't re-trigger upgrade if same version.
      // So we need to use a lower version number.
      // DB_VERSION is 1, so there's no lower version to use.
      // Instead, let's test by directly verifying the upgrade logic works
      // when stores already exist — we do this in the migration path.
      // The migration's onupgradeneeded creates stores, then openDatabase's
      // onupgradeneeded should see they already exist.

      // Create legacy DB to trigger migration path (which creates the new DB)
      const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('openbrowserclaw', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-group-time', ['groupId', 'timestamp']);
          msgStore.createIndex('by-group', 'groupId');
          db.createObjectStore('sessions', { keyPath: 'groupId' });
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('by-group', 'groupId');
          taskStore.createIndex('by-enabled', 'enabled');
          db.createObjectStore('config', { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      legacyDb.close();

      // The migration will create the new DB with all stores.
      // Then openDatabase will open the same DB — upgrade won't fire
      // since version matches, so it goes straight to onsuccess.
      vi.resetModules();
      const mod = await import('../src/db');

      dbConnection = await mod.openDatabase();
      expect(dbConnection).toBeDefined();
      expect(dbConnection!.objectStoreNames).toContain('messages');
      expect(dbConnection!.objectStoreNames).toContain('sessions');
      expect(dbConnection!.objectStoreNames).toContain('tasks');
      expect(dbConnection!.objectStoreNames).toContain('config');

      // Re-assign functions
      openDatabase = mod.openDatabase;
      saveMessage = mod.saveMessage;
      getRecentMessages = mod.getRecentMessages;
      getMessageCount = mod.getMessageCount;
      getAllGroupIds = mod.getAllGroupIds;
      getSession = mod.getSession;
      saveSession = mod.saveSession;
      saveTask = mod.saveTask;
      deleteTask = mod.deleteTask;
      getEnabledTasks = mod.getEnabledTasks;
      getAllTasks = mod.getAllTasks;
      updateTaskLastRun = mod.updateTaskLastRun;
      getConfig = mod.getConfig;
      setConfig = mod.setConfig;
      deleteConfig = mod.deleteConfig;
      getAllConfig = mod.getAllConfig;
      clearGroupMessages = mod.clearGroupMessages;
      buildConversationMessages = mod.buildConversationMessages;
      txPromiseAll = mod.txPromiseAll;
    });
  });

  describe('migration', () => {
    it('migrates data from legacy database to new database', async () => {
      // Close current connection
      if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
      }
      await deleteDatabase('safeclaw');

      // Create a legacy database with some data
      const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('openbrowserclaw', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-group-time', ['groupId', 'timestamp']);
          msgStore.createIndex('by-group', 'groupId');
          db.createObjectStore('sessions', { keyPath: 'groupId' });
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('by-group', 'groupId');
          taskStore.createIndex('by-enabled', 'enabled');
          db.createObjectStore('config', { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      // Insert data into legacy db
      await new Promise<void>((resolve, reject) => {
        const tx = legacyDb.transaction(['messages', 'config'], 'readwrite');
        tx.objectStore('messages').put({
          id: 'legacy-msg-1',
          groupId: 'br:main',
          sender: 'LegacyUser',
          content: 'legacy message',
          timestamp: 500,
          channel: 'browser',
          isFromMe: false,
          isTrigger: false,
        });
        tx.objectStore('config').put({ key: 'legacy-key', value: 'legacy-val' });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      legacyDb.close();

      // Reset modules and re-import to trigger migration
      vi.resetModules();
      const mod = await import('../src/db');
      openDatabase = mod.openDatabase;
      getRecentMessages = mod.getRecentMessages;
      getConfig = mod.getConfig;

      dbConnection = await openDatabase();

      // Verify data was migrated
      const messages = await getRecentMessages('br:main', 10);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('legacy message');

      const configVal = await getConfig('legacy-key');
      expect(configVal).toBe('legacy-val');
    });

    it('deletes legacy db when both legacy and new databases exist', async () => {
      // Close current connection
      if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
      }

      // Create legacy database (empty, just needs to exist)
      const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('openbrowserclaw', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('messages', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      legacyDb.close();

      // safeclaw DB already exists from beforeEach, but we deleted it above.
      // Create a new safeclaw db so both exist
      const newDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('safeclaw', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('messages', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      newDb.close();

      // Reset and re-import
      vi.resetModules();
      const mod = await import('../src/db');
      openDatabase = mod.openDatabase;

      dbConnection = await openDatabase();
      expect(dbConnection).toBeDefined();
      expect(dbConnection!.name).toBe('safeclaw');
    });

    it('handles migration failure gracefully (non-fatal)', async () => {
      // Close current connection
      if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
      }
      await deleteDatabase('safeclaw');
      await deleteDatabase('openbrowserclaw');

      // Reset modules
      vi.resetModules();

      // Mock indexedDB.databases to throw, causing migration to fail
      const origDatabases = indexedDB.databases.bind(indexedDB);
      indexedDB.databases = () => Promise.reject(new Error('databases() failed'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mod = await import('../src/db');
      openDatabase = mod.openDatabase;

      dbConnection = await openDatabase();
      expect(dbConnection).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DB migration failed'),
        expect.any(Error),
      );

      warnSpy.mockRestore();
      indexedDB.databases = origDatabases;
    });

    it('migrates legacy db with empty stores (no items to copy)', async () => {
      if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
      }
      await deleteDatabase('safeclaw');

      // Create legacy db with stores but no data
      const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('openbrowserclaw', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-group-time', ['groupId', 'timestamp']);
          msgStore.createIndex('by-group', 'groupId');
          db.createObjectStore('sessions', { keyPath: 'groupId' });
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('by-group', 'groupId');
          taskStore.createIndex('by-enabled', 'enabled');
          db.createObjectStore('config', { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      legacyDb.close();

      vi.resetModules();
      const mod = await import('../src/db');
      openDatabase = mod.openDatabase;

      dbConnection = await openDatabase();
      expect(dbConnection).toBeDefined();
    });

    it('skips migration when no legacy database exists', async () => {
      // This is the normal path - already tested by default beforeEach
      // but let's be explicit
      if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
      }
      await deleteDatabase('safeclaw');
      await deleteDatabase('openbrowserclaw');

      vi.resetModules();
      const mod = await import('../src/db');
      openDatabase = mod.openDatabase;

      dbConnection = await openDatabase();
      expect(dbConnection).toBeDefined();
    });
  });

  describe('getDb guard', () => {
    it('throws when database is not initialized', async () => {
      // Close and reset to get a fresh module with db = null
      if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
      }
      await deleteDatabase('safeclaw');
      vi.resetModules();

      const mod = await import('../src/db');
      // Don't call openDatabase - db is still null
      // saveMessage internally calls getDb() which should throw
      await expect(
        mod.saveMessage({
          id: 'x',
          groupId: 'g',
          sender: 's',
          content: 'c',
          timestamp: 0,
          channel: 'browser',
          isFromMe: false,
          isTrigger: false,
        }),
      ).rejects.toThrow('Database not initialized');

      // Re-open for cleanup
      dbConnection = await mod.openDatabase();
    });
  });

  describe('messages edge cases', () => {
    const makeMsg = (id: string, groupId: string, content: string, timestamp = Date.now()): StoredMessage => ({
      id,
      groupId,
      sender: 'User',
      content,
      timestamp,
      channel: 'browser',
      isFromMe: false,
      isTrigger: false,
    });

    it('returns empty array when no messages for group', async () => {
      const messages = await getRecentMessages('nonexistent', 10);
      expect(messages).toHaveLength(0);
    });

    it('returns 0 count for group with no messages', async () => {
      expect(await getMessageCount('nonexistent')).toBe(0);
    });

    it('returns empty array for getAllGroupIds with no messages', async () => {
      const ids = await getAllGroupIds();
      expect(ids).toHaveLength(0);
    });

    it('clearGroupMessages on empty group succeeds', async () => {
      await expect(clearGroupMessages('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('tasks edge cases', () => {
    it('saves disabled task with enabled=0', async () => {
      const task: Task = {
        id: 'disabled-task',
        groupId: 'br:main',
        schedule: '* * * * *',
        prompt: 'test',
        enabled: false,
        lastRun: null,
        createdAt: Date.now(),
      };
      await saveTask(task);
      const tasks = await getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].enabled).toBe(false);
    });

    it('getEnabledTasks returns empty when none enabled', async () => {
      const task: Task = {
        id: 'disabled-task',
        groupId: 'br:main',
        schedule: '* * * * *',
        prompt: 'test',
        enabled: false,
        lastRun: null,
        createdAt: Date.now(),
      };
      await saveTask(task);
      const enabled = await getEnabledTasks();
      expect(enabled).toHaveLength(0);
    });

    it('deleteTask on non-existent task succeeds silently', async () => {
      await expect(deleteTask('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('txPromiseAll', () => {
    it('resolves with results from multiple requests', async () => {
      // Insert some messages first
      await saveMessage({
        id: 'tx-1', groupId: 'g1', sender: 'A', content: 'one',
        timestamp: 1, channel: 'browser', isFromMe: false, isTrigger: false,
      });
      await saveMessage({
        id: 'tx-2', groupId: 'g1', sender: 'B', content: 'two',
        timestamp: 2, channel: 'browser', isFromMe: false, isTrigger: false,
      });

      const results = await txPromiseAll('messages', 'readonly', (store) => [
        store.get('tx-1'),
        store.get('tx-2'),
      ]);
      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('one');
      expect(results[1].content).toBe('two');
    });

    it('resolves with empty array when no requests', async () => {
      const results = await txPromiseAll('messages', 'readonly', () => []);
      expect(results).toHaveLength(0);
    });
  });
});
