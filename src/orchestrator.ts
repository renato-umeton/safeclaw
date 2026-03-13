// ---------------------------------------------------------------------------
// SafeClaw — Orchestrator
// ---------------------------------------------------------------------------
//
// The orchestrator is the main thread coordinator. It manages:
// - State machine (idle -> thinking -> responding)
// - Message queue and routing
// - Worker pool lifecycle (concurrent agent invocations)
// - Channel coordination
// - Task scheduling
// - Multi-provider LLM configuration

import type {
  InboundMessage,
  StoredMessage,
  WorkerOutbound,
  OrchestratorState,
  Task,
  ConversationMessage,
  ThinkingLogEntry,
  WorkerProviderConfig,
} from './types.js';
import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  CONTEXT_WINDOW_SIZE,
  DEFAULT_GROUP_ID,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  buildTriggerPattern,
} from './config.js';
import {
  openDatabase,
  saveMessage,
  getRecentMessages,
  buildConversationMessages,
  getConfig,
  setConfig,
  saveTask,
  clearGroupMessages,
} from './db.js';
import { readGroupFile } from './storage.js';
import { encryptValue, decryptValue, migrateKeystore } from './crypto.js';
import { migrateFromLegacyOpfs } from './storage.js';
import { BrowserChatChannel } from './channels/browser-chat.js';
import { TelegramChannel } from './channels/telegram.js';
import { Router } from './router.js';
import { TaskScheduler } from './task-scheduler.js';
import { ulid } from './ulid.js';
import type { ProviderId, LocalPreference } from './providers/types.js';
import { WorkerPool } from './worker-pool.js';
import type { WorkerHandle } from './worker-pool.js';

// ---------------------------------------------------------------------------
// Event emitter for UI updates
// ---------------------------------------------------------------------------

type EventMap = {
  'state-change': OrchestratorState;
  'message': StoredMessage;
  'typing': { groupId: string; typing: boolean };
  'tool-activity': { groupId: string; tool: string; status: string };
  'thinking-log': ThinkingLogEntry;
  'error': { groupId: string; error: string };
  'ready': void;
  'session-reset': { groupId: string };
  'context-compacted': { groupId: string; summary: string };
  'token-usage': import('./types.js').TokenUsage;
  'webllm-progress': { model: string; progress: number; status: string };
};

type EventCallback<T> = (data: T) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback<any>>>();

  on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class Orchestrator {
  readonly events = new EventBus();
  readonly browserChat = new BrowserChatChannel();
  readonly telegram = new TelegramChannel();

  private router!: Router;
  private scheduler!: TaskScheduler;
  private workerPool!: WorkerPool;
  private state: OrchestratorState = 'idle';
  private triggerPattern!: RegExp;
  private assistantName: string = ASSISTANT_NAME;

  // Multi-provider config
  private apiKeys: Partial<Record<ProviderId, string>> = {};
  private providerId: ProviderId = DEFAULT_PROVIDER as ProviderId;
  private model: string = DEFAULT_MODEL;
  private maxTokens: number = DEFAULT_MAX_TOKENS;
  private localPreference: LocalPreference = 'offline-only';

  private messageQueue: InboundMessage[] = [];
  /** Groups currently being processed — enables per-group concurrency */
  private activeGroups = new Set<string>();
  private pendingScheduledTasks = new Set<string>();
  /** Maps groupId → WorkerHandle for releasing after response */
  private activeHandles = new Map<string, WorkerHandle>();

  /**
   * Initialize the orchestrator. Must be called before anything else.
   */
  async init(): Promise<void> {
    // Run migrations (keystore must migrate before DB, since DB migration reads encrypted keys)
    try { await migrateKeystore(); } catch (err) { console.warn('[SafeClaw] Keystore migration failed:', err); }
    try { await migrateFromLegacyOpfs(); } catch (err) { console.warn('[SafeClaw] OPFS migration failed:', err); }

    // Open database (runs its own legacy DB migration)
    await openDatabase();

    // Load config
    this.assistantName = (await getConfig(CONFIG_KEYS.ASSISTANT_NAME)) || ASSISTANT_NAME;
    this.triggerPattern = buildTriggerPattern(this.assistantName);

    // Load API keys
    const storedAnthropicKey = await getConfig(CONFIG_KEYS.ANTHROPIC_API_KEY);
    if (storedAnthropicKey) {
      try {
        this.apiKeys.anthropic = await decryptValue(storedAnthropicKey);
      } catch {
        this.apiKeys.anthropic = '';
        await setConfig(CONFIG_KEYS.ANTHROPIC_API_KEY, '');
      }
    }

    const storedGeminiKey = await getConfig(CONFIG_KEYS.GEMINI_API_KEY);
    if (storedGeminiKey) {
      try {
        this.apiKeys.gemini = await decryptValue(storedGeminiKey);
      } catch {
        this.apiKeys.gemini = '';
        await setConfig(CONFIG_KEYS.GEMINI_API_KEY, '');
      }
    }

    // Load provider/model config
    this.providerId = ((await getConfig(CONFIG_KEYS.PROVIDER)) || DEFAULT_PROVIDER) as ProviderId;
    this.model = (await getConfig(CONFIG_KEYS.MODEL)) || DEFAULT_MODEL;
    this.maxTokens = parseInt(
      (await getConfig(CONFIG_KEYS.MAX_TOKENS)) || String(DEFAULT_MAX_TOKENS),
      10,
    );
    this.localPreference = ((await getConfig(CONFIG_KEYS.LOCAL_PREFERENCE)) || 'offline-only') as LocalPreference;

    // Set up router
    this.router = new Router(this.browserChat, this.telegram);

    // Set up channels
    this.browserChat.onMessage((msg) => this.enqueue(msg));

    // Configure Telegram if token exists
    const telegramToken = await getConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN);
    if (telegramToken) {
      const chatIdsRaw = await getConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS);
      const chatIds: string[] = chatIdsRaw ? JSON.parse(chatIdsRaw) : [];
      this.telegram.configure(telegramToken, chatIds);
      this.telegram.onMessage((msg) => this.enqueue(msg));
      this.telegram.start();
    }

    // Set up worker pool (up to 3 concurrent agent workers)
    this.workerPool = new WorkerPool(
      new URL('./agent-worker.ts', import.meta.url),
      { maxWorkers: 3 },
    );
    this.workerPool.onMessage((msg: WorkerOutbound) => {
      this.handleWorkerMessage(msg);
    });
    this.workerPool.onError((err) => {
      console.error('Agent worker error:', err);
    });

    // Set up task scheduler
    this.scheduler = new TaskScheduler((groupId, prompt) =>
      this.invokeAgent(groupId, prompt),
    );
    this.scheduler.start();

    // Wire up browser chat display callback
    this.browserChat.onDisplay((groupId, text, isFromMe) => {
      // Display handled via events.emit('message', ...)
    });

    this.events.emit('ready', undefined);
  }

  /**
   * Get the current state.
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Check if at least one provider is usable — either a cloud API key is set,
   * or local mode is enabled (local preference "always" or a local provider selected).
   */
  isConfigured(): boolean {
    const hasCloudKey = !!(this.apiKeys.anthropic || this.apiKeys.gemini);
    const isLocalProvider = this.providerId === 'webllm' || this.providerId === 'chrome-ai';
    const localAlways = this.localPreference === 'always';
    return hasCloudKey || isLocalProvider || localAlways;
  }

  /**
   * Update an API key for a specific provider.
   */
  async setApiKey(provider: ProviderId, key: string): Promise<void> {
    this.apiKeys[provider] = key;
    const configKey = provider === 'anthropic'
      ? CONFIG_KEYS.ANTHROPIC_API_KEY
      : CONFIG_KEYS.GEMINI_API_KEY;
    const encrypted = await encryptValue(key);
    await setConfig(configKey, encrypted);
  }

  /**
   * Get API key for a provider (decrypted).
   */
  getApiKey(provider: ProviderId): string {
    return this.apiKeys[provider] || '';
  }

  /**
   * Get current provider ID.
   */
  getProviderId(): ProviderId {
    return this.providerId;
  }

  /**
   * Set the active provider.
   */
  async setProviderId(id: ProviderId): Promise<void> {
    this.providerId = id;
    await setConfig(CONFIG_KEYS.PROVIDER, id);
  }

  /**
   * Get current model.
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Update the model.
   */
  async setModel(model: string): Promise<void> {
    this.model = model;
    await setConfig(CONFIG_KEYS.MODEL, model);
  }

  /**
   * Get local preference.
   */
  getLocalPreference(): LocalPreference {
    return this.localPreference;
  }

  /**
   * Set local preference.
   */
  async setLocalPreference(pref: LocalPreference): Promise<void> {
    this.localPreference = pref;
    await setConfig(CONFIG_KEYS.LOCAL_PREFERENCE, pref);
  }

  /**
   * Get assistant name.
   */
  getAssistantName(): string {
    return this.assistantName;
  }

  /**
   * Update assistant name and trigger pattern.
   */
  async setAssistantName(name: string): Promise<void> {
    this.assistantName = name;
    this.triggerPattern = buildTriggerPattern(name);
    await setConfig(CONFIG_KEYS.ASSISTANT_NAME, name);
  }

  /**
   * Configure Telegram.
   */
  async configureTelegram(token: string, chatIds: string[]): Promise<void> {
    await setConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN, token);
    await setConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS, JSON.stringify(chatIds));
    this.telegram.configure(token, chatIds);
    this.telegram.onMessage((msg) => this.enqueue(msg));
    this.telegram.start();
  }

  /**
   * Pre-download and cache the currently selected local model.
   * Triggers progress events via the webllm-progress event.
   */
  preloadModel(): void {
    // Use a dedicated worker for preloading — acquire temporarily
    const handle = this.workerPool.acquire('__preload__');
    if (handle) {
      this.workerPool.postMessage(handle, {
        type: 'preload',
        payload: { providerConfig: this.buildProviderConfig() },
      });
      // Release immediately — preload is fire-and-forget
      this.workerPool.release(handle);
    }
  }

  /**
   * Submit a message from the browser chat UI.
   */
  submitMessage(text: string, groupId?: string): void {
    this.browserChat.submit(text, groupId);
  }

  /**
   * Start a completely new session — clears message history for the group.
   */
  async newSession(groupId: string = DEFAULT_GROUP_ID): Promise<void> {
    await clearGroupMessages(groupId);
    this.events.emit('session-reset', { groupId });
  }

  /**
   * Cancel an in-progress agent invocation for a group.
   */
  cancelInvocation(groupId: string): void {
    const handle = this.activeHandles.get(groupId);
    if (handle) {
      this.workerPool.postMessage(handle, {
        type: 'cancel',
        payload: { groupId },
      });
    }
  }

  /**
   * Compact (summarize) the current context to reduce token usage.
   */
  async compactContext(groupId: string = DEFAULT_GROUP_ID): Promise<void> {
    if (!this.isConfigured()) {
      this.events.emit('error', {
        groupId,
        error: 'No API key configured. Cannot compact context.',
      });
      return;
    }

    if (this.activeGroups.has(groupId)) {
      this.events.emit('error', {
        groupId,
        error: 'Cannot compact while processing. Wait for the current response to finish.',
      });
      return;
    }

    this.setState('thinking');
    this.events.emit('typing', { groupId, typing: true });

    // Load group memory
    let memory = '';
    try {
      memory = await readGroupFile(groupId, 'CLAUDE.md');
    } catch {
      // No memory file yet
    }

    const messages = await buildConversationMessages(groupId, CONTEXT_WINDOW_SIZE);
    const systemPrompt = buildSystemPrompt(this.assistantName, memory);

    const handle = this.workerPool.acquire(groupId);
    if (!handle) {
      this.events.emit('error', {
        groupId,
        error: 'All workers are busy. Please try again in a moment.',
      });
      this.setState('idle');
      this.events.emit('typing', { groupId, typing: false });
      return;
    }

    this.activeHandles.set(groupId, handle);
    this.workerPool.postMessage(handle, {
      type: 'compact',
      payload: {
        groupId,
        messages,
        systemPrompt,
        providerConfig: this.buildProviderConfig(),
      },
    });
  }

  /**
   * Shut down everything.
   */
  shutdown(): void {
    this.scheduler.stop();
    this.telegram.stop();
    this.workerPool.shutdown();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /** Build the provider config to pass to the worker */
  private buildProviderConfig(): WorkerProviderConfig {
    return {
      providerId: this.providerId,
      model: this.model,
      maxTokens: this.maxTokens,
      apiKeys: {
        anthropic: this.apiKeys.anthropic || '',
        gemini: this.apiKeys.gemini || '',
      },
      localPreference: this.localPreference,
    };
  }

  private setState(state: OrchestratorState): void {
    this.state = state;
    this.events.emit('state-change', state);
  }

  private async enqueue(msg: InboundMessage): Promise<void> {
    // Save to DB
    const stored: StoredMessage = {
      ...msg,
      isFromMe: false,
      isTrigger: false,
    };

    // Check trigger
    const isBrowserMain = msg.groupId === DEFAULT_GROUP_ID;
    const hasTrigger = this.triggerPattern.test(msg.content.trim());

    // Browser main group always triggers; other groups need the trigger pattern
    if (isBrowserMain || hasTrigger) {
      stored.isTrigger = true;
      this.messageQueue.push(msg);
    }

    await saveMessage(stored);
    this.events.emit('message', stored);

    // Process queue
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;
    if (!this.isConfigured()) {
      const msg = this.messageQueue.shift()!;
      this.events.emit('error', {
        groupId: msg.groupId,
        error: 'No API key configured. Go to Settings to add your API key.',
      });
      return;
    }

    // Process all queued messages that can run concurrently
    // (one per group, skip groups already active)
    const remaining: InboundMessage[] = [];
    const toProcess: InboundMessage[] = [];

    for (const msg of this.messageQueue) {
      if (this.activeGroups.has(msg.groupId)) {
        // This group is already processing — keep in queue
        remaining.push(msg);
      } else {
        toProcess.push(msg);
      }
    }
    this.messageQueue = remaining;

    // Invoke agent for each group concurrently
    for (const msg of toProcess) {
      this.invokeAgent(msg.groupId, msg.content).catch((err) => {
        console.error('Failed to invoke agent:', err);
      });
    }
  }

  private async invokeAgent(groupId: string, triggerContent: string): Promise<void> {
    // Mark this group as active
    this.activeGroups.add(groupId);
    this.setState('thinking');
    this.router.setTyping(groupId, true);
    this.events.emit('typing', { groupId, typing: true });

    // If this is a scheduled task, save the prompt as a user message so
    // it appears in conversation context and in the chat UI.
    if (triggerContent.startsWith('[SCHEDULED TASK]')) {
      this.pendingScheduledTasks.add(groupId);
      const stored: StoredMessage = {
        id: ulid(),
        groupId,
        sender: 'Scheduler',
        content: triggerContent,
        timestamp: Date.now(),
        channel: groupId.startsWith('tg:') ? 'telegram' : 'browser',
        isFromMe: false,
        isTrigger: true,
      };
      await saveMessage(stored);
      this.events.emit('message', stored);
    }

    // Load group memory
    let memory = '';
    try {
      memory = await readGroupFile(groupId, 'CLAUDE.md');
    } catch {
      // No memory file yet — that's fine
    }

    // Build conversation context
    const messages = await buildConversationMessages(groupId, CONTEXT_WINDOW_SIZE);

    const systemPrompt = buildSystemPrompt(this.assistantName, memory);

    // Acquire a worker from the pool
    const handle = this.workerPool.acquire(groupId);
    if (!handle) {
      // Pool is full — re-queue the message for later
      this.activeGroups.delete(groupId);
      this.messageQueue.push({
        id: ulid(),
        groupId,
        sender: 'User',
        content: triggerContent,
        timestamp: Date.now(),
        channel: groupId.startsWith('tg:') ? 'telegram' : 'browser',
      });
      this.events.emit('error', {
        groupId,
        error: 'All workers are busy. Your message has been queued and will be processed shortly.',
      });
      // Update state if no other groups are active
      if (this.activeGroups.size === 0) {
        this.setState('idle');
      }
      return;
    }

    this.activeHandles.set(groupId, handle);

    // Send to agent worker with provider config
    this.workerPool.postMessage(handle, {
      type: 'invoke',
      payload: {
        groupId,
        messages,
        systemPrompt,
        providerConfig: this.buildProviderConfig(),
      },
    });
  }

  private async handleWorkerMessage(msg: WorkerOutbound): Promise<void> {
    switch (msg.type) {
      case 'response': {
        const { groupId, text } = msg.payload;
        this.releaseWorker(groupId);
        await this.deliverResponse(groupId, text);
        break;
      }

      case 'task-created': {
        const { task } = msg.payload;
        try {
          await saveTask(task);
        } catch (err) {
          console.error('Failed to save task from agent:', err);
        }
        break;
      }

      case 'error': {
        const { groupId, error } = msg.payload;
        this.releaseWorker(groupId);
        await this.deliverResponse(groupId, `Warning: Error: ${error}`);
        break;
      }

      case 'typing': {
        const { groupId } = msg.payload;
        this.router.setTyping(groupId, true);
        this.events.emit('typing', { groupId, typing: true });
        break;
      }

      case 'tool-activity': {
        this.events.emit('tool-activity', msg.payload);
        break;
      }

      case 'thinking-log': {
        this.events.emit('thinking-log', msg.payload);
        break;
      }

      case 'compact-done': {
        this.releaseWorker(msg.payload.groupId);
        await this.handleCompactDone(msg.payload.groupId, msg.payload.summary);
        break;
      }

      case 'token-usage': {
        this.events.emit('token-usage', msg.payload);
        break;
      }

      case 'webllm-progress': {
        this.events.emit('webllm-progress', msg.payload);
        break;
      }
    }
  }

  /** Release worker back to pool and mark group as no longer active */
  private releaseWorker(groupId: string): void {
    const handle = this.activeHandles.get(groupId);
    if (handle) {
      this.workerPool.release(handle);
      this.activeHandles.delete(groupId);
    }
    this.activeGroups.delete(groupId);

    // Re-process queued messages now that a worker is free
    if (this.messageQueue.length > 0) {
      this.processQueue();
    }
  }

  private async handleCompactDone(groupId: string, summary: string): Promise<void> {
    // Clear old messages
    await clearGroupMessages(groupId);

    // Save the summary as a system-style message from the assistant
    const stored: StoredMessage = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: `**Context Compacted**\n\n${summary}`,
      timestamp: Date.now(),
      channel: groupId.startsWith('tg:') ? 'telegram' : 'browser',
      isFromMe: true,
      isTrigger: false,
    };
    await saveMessage(stored);

    this.events.emit('context-compacted', { groupId, summary });
    this.events.emit('typing', { groupId, typing: false });
    if (this.activeGroups.size === 0) {
      this.setState('idle');
    }
  }

  private async deliverResponse(groupId: string, text: string): Promise<void> {
    // Save to DB
    const stored: StoredMessage = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: text,
      timestamp: Date.now(),
      channel: groupId.startsWith('tg:') ? 'telegram' : 'browser',
      isFromMe: true,
      isTrigger: false,
      model: this.model,
      providerId: this.providerId,
    };
    await saveMessage(stored);

    // Route to channel
    await this.router.send(groupId, text);

    // Play notification chime for scheduled task responses
    if (this.pendingScheduledTasks.has(groupId)) {
      this.pendingScheduledTasks.delete(groupId);
      playNotificationChime();
    }

    // Emit for UI
    this.events.emit('message', stored);
    this.events.emit('typing', { groupId, typing: false });

    // Only go idle if no other groups are active
    if (this.activeGroups.size === 0) {
      this.setState('idle');
    }
    this.router.setTyping(groupId, false);
  }
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(assistantName: string, memory: string): string {
  const parts = [
    `You are ${assistantName}, a personal AI assistant running in the user's browser.`,
    '',
    'You have access to the following tools:',
    '- **bash**: Execute commands in a sandboxed Linux VM (Alpine). Use for scripts, text processing, package installation.',
    '- **javascript**: Execute JavaScript code. Lighter than bash — no VM boot needed. Use for calculations, data transforms.',
    '- **read_file** / **write_file** / **list_files**: Manage files in the group workspace (persisted in browser storage).',
    '- **fetch_url**: Make HTTP requests (subject to CORS).',
    '- **update_memory**: Persist important context to CLAUDE.md — loaded on every conversation.',
    '- **create_task**: Schedule recurring tasks with cron expressions.',
    '',
    'Guidelines:',
    '- Be concise and direct.',
    '- Use tools proactively when they help answer the question.',
    '- Update memory when you learn important preferences or context.',
    '- For scheduled tasks, confirm the schedule with the user.',
    '- Strip <internal> tags from your responses — they are for your internal reasoning only.',
  ];

  if (memory) {
    parts.push('', '## Persistent Memory', '', memory);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Notification chime (Web Audio API — no external files needed)
// ---------------------------------------------------------------------------

function playNotificationChime(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-tone chime: C5 -> E5
    const frequencies = [523.25, 659.25];
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = frequencies[i];

      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    }

    // Clean up context after sounds finish
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // AudioContext may not be available — fail silently
  }
}
