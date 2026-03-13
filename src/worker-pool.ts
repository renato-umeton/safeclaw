// ---------------------------------------------------------------------------
// SafeClaw — Worker Pool
// ---------------------------------------------------------------------------
//
// Manages a pool of Web Workers for concurrent agent invocations.
// Each worker handles one invocation at a time. Workers are reused
// from an idle pool when available, or created on demand up to a
// configurable maximum.
//
// This prevents the app from hanging when multiple groups (e.g.,
// browser chat + scheduled tasks + Telegram) need the agent
// simultaneously.

import type { WorkerInbound, WorkerOutbound } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerHandle {
  /** The underlying Web Worker instance */
  worker: Worker;
  /** The group this worker is currently serving */
  groupId: string;
}

export interface WorkerPoolOptions {
  /** Maximum number of concurrent workers (default: 3) */
  maxWorkers?: number;
}

// ---------------------------------------------------------------------------
// WorkerPool
// ---------------------------------------------------------------------------

export class WorkerPool {
  private readonly workerUrl: URL;
  private readonly maxWorkers: number;

  /** Workers currently processing an invocation, keyed by groupId */
  private active = new Map<string, WorkerHandle>();

  /** Workers sitting idle, ready for reuse */
  private idle: Worker[] = [];

  /** Registered message handler */
  private messageHandler: ((msg: WorkerOutbound) => void) | null = null;

  /** Registered error handler */
  private errorHandler: ((err: ErrorEvent) => void) | null = null;

  constructor(workerUrl: URL, options: WorkerPoolOptions = {}) {
    this.workerUrl = workerUrl;
    this.maxWorkers = options.maxWorkers ?? 3;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Number of workers currently handling invocations */
  get activeCount(): number {
    return this.active.size;
  }

  /** Number of idle workers available for reuse */
  get idleCount(): number {
    return this.idle.length;
  }

  /**
   * Acquire a worker for a group. Returns a handle to interact with
   * the worker, or null if the pool is full or the group already has
   * an active worker.
   */
  acquire(groupId: string): WorkerHandle | null {
    // Prevent double-acquire for the same group
    if (this.active.has(groupId)) return null;

    // Check capacity
    if (this.active.size >= this.maxWorkers) return null;

    // Reuse idle worker or create new one
    const worker = this.idle.pop() || this.createWorker();

    const handle: WorkerHandle = { worker, groupId };
    this.active.set(groupId, handle);
    return handle;
  }

  /**
   * Release a worker back to the idle pool after its invocation
   * completes. Safe to call multiple times.
   */
  release(handle: WorkerHandle): void {
    if (!this.active.has(handle.groupId)) return;
    this.active.delete(handle.groupId);
    this.idle.push(handle.worker);
  }

  /**
   * Post a message to a specific worker via its handle.
   */
  postMessage(handle: WorkerHandle, message: WorkerInbound): void {
    handle.worker.postMessage(message);
  }

  /**
   * Broadcast a message to all active workers (e.g., cancel).
   */
  broadcast(message: WorkerInbound): void {
    for (const handle of this.active.values()) {
      handle.worker.postMessage(message);
    }
  }

  /**
   * Check if a group currently has an active worker.
   */
  hasActiveGroup(groupId: string): boolean {
    return this.active.has(groupId);
  }

  /**
   * Register a handler for messages from any worker.
   */
  onMessage(handler: (msg: WorkerOutbound) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Register a handler for worker errors.
   */
  onError(handler: (err: ErrorEvent) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Terminate all workers (active and idle) and reset the pool.
   */
  shutdown(): void {
    for (const handle of this.active.values()) {
      handle.worker.terminate();
    }
    for (const worker of this.idle) {
      worker.terminate();
    }
    this.active.clear();
    this.idle = [];
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private createWorker(): Worker {
    const worker = new Worker(this.workerUrl, { type: 'module' });

    worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
      this.messageHandler?.(event.data);
    };

    worker.onerror = (err: ErrorEvent) => {
      this.errorHandler?.(err);
    };

    return worker;
  }
}
