import { WorkerPool } from '../src/worker-pool';
import type { WorkerInbound, WorkerOutbound } from '../src/types';

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = new WorkerPool(new URL('file:///test/agent-worker.ts'), { maxWorkers: 3 });
  });

  afterEach(() => {
    pool.shutdown();
  });

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  describe('construction', () => {
    it('creates with default options', () => {
      const p = new WorkerPool(new URL('file:///test/agent-worker.ts'));
      expect(p.activeCount).toBe(0);
      expect(p.idleCount).toBe(0);
      p.shutdown();
    });

    it('creates with custom maxWorkers', () => {
      const p = new WorkerPool(new URL('file:///test/agent-worker.ts'), { maxWorkers: 5 });
      expect(p.activeCount).toBe(0);
      p.shutdown();
    });
  });

  // -----------------------------------------------------------------------
  // Acquiring and releasing workers
  // -----------------------------------------------------------------------

  describe('acquire', () => {
    it('creates a new worker on first acquire', () => {
      const handle = pool.acquire('group-1');
      expect(handle).not.toBeNull();
      expect(handle!.worker).toBeDefined();
      expect(pool.activeCount).toBe(1);
    });

    it('allows concurrent workers for different groups', () => {
      const h1 = pool.acquire('group-1')!;
      const h2 = pool.acquire('group-2')!;
      const h3 = pool.acquire('group-3')!;
      expect(pool.activeCount).toBe(3);
      expect(h1.worker).not.toBe(h2.worker);
      expect(h2.worker).not.toBe(h3.worker);
    });

    it('returns null when max workers reached', () => {
      pool.acquire('group-1');
      pool.acquire('group-2');
      pool.acquire('group-3');
      const h4 = pool.acquire('group-4');
      expect(h4).toBeNull();
      expect(pool.activeCount).toBe(3);
    });

    it('reuses idle workers from the pool', () => {
      const h1 = pool.acquire('group-1')!;
      const w1 = h1.worker;
      pool.release(h1);
      expect(pool.idleCount).toBe(1);

      const h2 = pool.acquire('group-2')!;
      expect(h2.worker).toBe(w1);
      expect(pool.idleCount).toBe(0);
      expect(pool.activeCount).toBe(1);
    });

    it('prevents double-acquire for the same group', () => {
      pool.acquire('group-1');
      const h2 = pool.acquire('group-1');
      expect(h2).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Releasing workers
  // -----------------------------------------------------------------------

  describe('release', () => {
    it('moves worker to idle pool on release', () => {
      const h = pool.acquire('group-1')!;
      expect(pool.activeCount).toBe(1);
      pool.release(h);
      expect(pool.activeCount).toBe(0);
      expect(pool.idleCount).toBe(1);
    });

    it('is safe to release the same handle twice', () => {
      const h = pool.acquire('group-1')!;
      pool.release(h);
      pool.release(h); // no-op
      expect(pool.idleCount).toBe(1);
      expect(pool.activeCount).toBe(0);
    });

    it('allows the same group to acquire again after release', () => {
      const h1 = pool.acquire('group-1')!;
      pool.release(h1);
      const h2 = pool.acquire('group-1');
      expect(h2).not.toBeNull();
      expect(pool.activeCount).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Posting messages
  // -----------------------------------------------------------------------

  describe('postMessage', () => {
    it('forwards messages to the acquired worker', () => {
      const h = pool.acquire('group-1')!;
      const msg: WorkerInbound = {
        type: 'invoke',
        payload: {
          groupId: 'group-1',
          messages: [],
          systemPrompt: 'test',
          providerConfig: {
            providerId: 'anthropic',
            model: 'claude-sonnet-4-6',
            maxTokens: 1024,
            apiKeys: { anthropic: 'key' },
            localPreference: 'offline-only',
          },
        },
      };
      pool.postMessage(h, msg);
      expect(h.worker.postMessage).toHaveBeenCalledWith(msg);
    });
  });

  // -----------------------------------------------------------------------
  // Message routing
  // -----------------------------------------------------------------------

  describe('onMessage', () => {
    it('routes worker messages to the registered handler', () => {
      const handler = vi.fn();
      pool.onMessage(handler);

      const h = pool.acquire('group-1')!;
      // Simulate the worker posting a message back
      const workerMsg: WorkerOutbound = {
        type: 'response',
        payload: { groupId: 'group-1', text: 'hello' },
      };
      h.worker.onmessage!({ data: workerMsg } as MessageEvent);

      expect(handler).toHaveBeenCalledWith(workerMsg);
    });

    it('routes messages from multiple concurrent workers', () => {
      const handler = vi.fn();
      pool.onMessage(handler);

      const h1 = pool.acquire('group-1')!;
      const h2 = pool.acquire('group-2')!;

      h1.worker.onmessage!({
        data: { type: 'response', payload: { groupId: 'group-1', text: 'from-1' } },
      } as MessageEvent);
      h2.worker.onmessage!({
        data: { type: 'response', payload: { groupId: 'group-2', text: 'from-2' } },
      } as MessageEvent);

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe('onError', () => {
    it('routes worker errors to the registered handler', () => {
      const handler = vi.fn();
      pool.onError(handler);

      const h = pool.acquire('group-1')!;
      const err = new ErrorEvent('error', { message: 'boom' });
      h.worker.onerror!(err);

      expect(handler).toHaveBeenCalledWith(err);
    });
  });

  // -----------------------------------------------------------------------
  // Shutdown
  // -----------------------------------------------------------------------

  describe('shutdown', () => {
    it('terminates all active and idle workers', () => {
      const h1 = pool.acquire('group-1')!;
      const h2 = pool.acquire('group-2')!;
      pool.release(h2);
      // h1 is active, h2 is idle

      pool.shutdown();

      expect(h1.worker.terminate).toHaveBeenCalled();
      expect(h2.worker.terminate).toHaveBeenCalled();
      expect(pool.activeCount).toBe(0);
      expect(pool.idleCount).toBe(0);
    });

    it('is safe to call shutdown multiple times', () => {
      pool.acquire('group-1');
      pool.shutdown();
      pool.shutdown(); // no-op
      expect(pool.activeCount).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // hasActiveGroup
  // -----------------------------------------------------------------------

  describe('hasActiveGroup', () => {
    it('returns true when a group has an active worker', () => {
      pool.acquire('group-1');
      expect(pool.hasActiveGroup('group-1')).toBe(true);
      expect(pool.hasActiveGroup('group-2')).toBe(false);
    });

    it('returns false after release', () => {
      const h = pool.acquire('group-1')!;
      pool.release(h);
      expect(pool.hasActiveGroup('group-1')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Broadcast
  // -----------------------------------------------------------------------

  describe('broadcast', () => {
    it('sends a message to all active workers', () => {
      const h1 = pool.acquire('group-1')!;
      const h2 = pool.acquire('group-2')!;
      const msg: WorkerInbound = {
        type: 'cancel',
        payload: { groupId: '' },
      };
      pool.broadcast(msg);
      expect(h1.worker.postMessage).toHaveBeenCalledWith(msg);
      expect(h2.worker.postMessage).toHaveBeenCalledWith(msg);
    });

    it('does not send to idle workers', () => {
      const h1 = pool.acquire('group-1')!;
      const h2 = pool.acquire('group-2')!;
      pool.release(h2);
      const msg: WorkerInbound = {
        type: 'cancel',
        payload: { groupId: '' },
      };
      pool.broadcast(msg);
      expect(h1.worker.postMessage).toHaveBeenCalledWith(msg);
      expect(h2.worker.postMessage).not.toHaveBeenCalledWith(msg);
    });
  });
});
