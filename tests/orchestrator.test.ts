import { Orchestrator } from '../src/orchestrator';

// The orchestrator opens an IndexedDB connection in init().
// We reuse a single instance across all tests to avoid OOM.
describe('Orchestrator', () => {
  describe('event bus (no init needed)', () => {
    it('subscribes and emits events', () => {
      const orch = new Orchestrator();
      const cb = vi.fn();
      orch.events.on('state-change', cb);
      orch.events.emit('state-change', 'thinking');
      expect(cb).toHaveBeenCalledWith('thinking');
    });

    it('unsubscribes from events', () => {
      const orch = new Orchestrator();
      const cb = vi.fn();
      orch.events.on('state-change', cb);
      orch.events.off('state-change', cb);
      orch.events.emit('state-change', 'thinking');
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('with init', () => {
    let orchestrator: Orchestrator;

    beforeAll(async () => {
      orchestrator = new Orchestrator();
      await orchestrator.init();
    });

    afterAll(() => {
      try { orchestrator.shutdown(); } catch { /* ignore */ }
    });

    it('initializes without error', () => {
      expect(orchestrator.getState()).toBe('idle');
    });

    it('loads default config', () => {
      expect(orchestrator.getAssistantName()).toBe('Andy');
      expect(orchestrator.getProviderId()).toBe('anthropic');
      expect(orchestrator.getModel()).toBe('claude-sonnet-4-6');
    });

    it('starts in idle state', () => {
      expect(orchestrator.getState()).toBe('idle');
    });

    it('returns false when no API keys set and local preference is not always', () => {
      expect(orchestrator.isConfigured()).toBe(false);
    });

    it('returns true when local preference is always even without API keys', async () => {
      await orchestrator.setLocalPreference('always');
      expect(orchestrator.isConfigured()).toBe(true);
      await orchestrator.setLocalPreference('offline-only');
    });

    it('returns true when provider is webllm even without API keys', async () => {
      await orchestrator.setProviderId('webllm');
      expect(orchestrator.isConfigured()).toBe(true);
      await orchestrator.setProviderId('anthropic');
    });

    it('returns true when provider is chrome-ai even without API keys', async () => {
      await orchestrator.setProviderId('chrome-ai');
      expect(orchestrator.isConfigured()).toBe(true);
      await orchestrator.setProviderId('anthropic');
    });

    it('returns empty string for unset keys', () => {
      expect(orchestrator.getApiKey('gemini')).toBe('');
    });

    it('sets and gets API keys', async () => {
      await orchestrator.setApiKey('anthropic', 'my-key');
      expect(orchestrator.getApiKey('anthropic')).toBe('my-key');
    });

    it('returns true when API key is set', () => {
      expect(orchestrator.isConfigured()).toBe(true);
    });

    it('sets provider ID', async () => {
      await orchestrator.setProviderId('gemini');
      expect(orchestrator.getProviderId()).toBe('gemini');
      await orchestrator.setProviderId('anthropic');
    });

    it('sets model', async () => {
      await orchestrator.setModel('claude-opus-4-6');
      expect(orchestrator.getModel()).toBe('claude-opus-4-6');
      await orchestrator.setModel('claude-sonnet-4-6');
    });

    it('persists model per provider and restores on provider switch', async () => {
      // Set a non-default model for webllm
      await orchestrator.setProviderId('webllm');
      await orchestrator.setModel('qwen3-4b');
      expect(orchestrator.getModel()).toBe('qwen3-4b');

      // Switch to chrome-ai — model should change to gemini-nano
      await orchestrator.setProviderId('chrome-ai');
      expect(orchestrator.getModel()).toBe('gemini-nano');

      // Switch back to webllm — should restore qwen3-4b (not default qwen3-0.6b)
      await orchestrator.setProviderId('webllm');
      expect(orchestrator.getModel()).toBe('qwen3-4b');

      // Clean up
      await orchestrator.setProviderId('anthropic');
      await orchestrator.setModel('claude-sonnet-4-6');
    });

    it('falls back to default model when no saved model for provider', async () => {
      // Switch to gemini for the first time (no saved model)
      await orchestrator.setProviderId('gemini');
      expect(orchestrator.getModel()).toBe('gemini-2.5-pro-preview-06-05');

      // Clean up
      await orchestrator.setProviderId('anthropic');
      await orchestrator.setModel('claude-sonnet-4-6');
    });

    it('sets local preference', async () => {
      await orchestrator.setLocalPreference('always');
      expect(orchestrator.getLocalPreference()).toBe('always');
      await orchestrator.setLocalPreference('offline-only');
    });

    it('sets assistant name and updates trigger pattern', async () => {
      await orchestrator.setAssistantName('TestBot');
      expect(orchestrator.getAssistantName()).toBe('TestBot');
      await orchestrator.setAssistantName('Andy');
    });

    it('submits to browser chat channel', () => {
      const submitSpy = vi.spyOn(orchestrator.browserChat, 'submit');
      orchestrator.submitMessage('hello');
      expect(submitSpy).toHaveBeenCalledWith('hello', undefined);
      submitSpy.mockRestore();
    });

    it('emits session-reset event on newSession', async () => {
      const resetCallback = vi.fn();
      orchestrator.events.on('session-reset', resetCallback);
      await orchestrator.newSession();
      expect(resetCallback).toHaveBeenCalledWith({ groupId: 'br:main' });
      orchestrator.events.off('session-reset', resetCallback);
    });

    it('emits error on compactContext when not configured', async () => {
      await orchestrator.setApiKey('anthropic', '');
      await orchestrator.setLocalPreference('offline-only');
      await orchestrator.setProviderId('anthropic');
      const errorCallback = vi.fn();
      orchestrator.events.on('error', errorCallback);
      await orchestrator.compactContext();
      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].error).toContain('No API key');
      orchestrator.events.off('error', errorCallback);
      await orchestrator.setApiKey('anthropic', 'my-key');
    });

    it('emits error on compactContext when not idle', async () => {
      (orchestrator as any).state = 'thinking';
      const errorCallback = vi.fn();
      orchestrator.events.on('error', errorCallback);
      await orchestrator.compactContext();
      expect(errorCallback).toHaveBeenCalled();
      orchestrator.events.off('error', errorCallback);
      (orchestrator as any).state = 'idle';
    });

    // --- handleWorkerMessage ---

    it('handles response message from worker', async () => {
      const msgCallback = vi.fn();
      const stateCallback = vi.fn();
      orchestrator.events.on('message', msgCallback);
      orchestrator.events.on('state-change', stateCallback);

      await (orchestrator as any).handleWorkerMessage({
        type: 'response',
        payload: { groupId: 'br:main', text: 'Hello from AI' },
      });

      expect(msgCallback).toHaveBeenCalled();
      expect(msgCallback.mock.calls[0][0].content).toBe('Hello from AI');
      expect(stateCallback).toHaveBeenCalledWith('idle');

      orchestrator.events.off('message', msgCallback);
      orchestrator.events.off('state-change', stateCallback);
    });

    it('handles error message from worker', async () => {
      const msgCallback = vi.fn();
      orchestrator.events.on('message', msgCallback);

      await (orchestrator as any).handleWorkerMessage({
        type: 'error',
        payload: { groupId: 'br:main', error: 'Something went wrong' },
      });

      expect(msgCallback).toHaveBeenCalled();
      expect(msgCallback.mock.calls[0][0].content).toContain('Error');

      orchestrator.events.off('message', msgCallback);
    });

    it('handles typing message from worker', () => {
      const typingCallback = vi.fn();
      orchestrator.events.on('typing', typingCallback);

      (orchestrator as any).handleWorkerMessage({
        type: 'typing',
        payload: { groupId: 'br:main' },
      });

      expect(typingCallback).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'br:main', typing: true }),
      );
      orchestrator.events.off('typing', typingCallback);
    });

    it('handles tool-activity message from worker', () => {
      const toolCallback = vi.fn();
      orchestrator.events.on('tool-activity', toolCallback);

      (orchestrator as any).handleWorkerMessage({
        type: 'tool-activity',
        payload: { groupId: 'br:main', tool: 'bash', status: 'running' },
      });

      expect(toolCallback).toHaveBeenCalledWith(
        expect.objectContaining({ tool: 'bash', status: 'running' }),
      );
      orchestrator.events.off('tool-activity', toolCallback);
    });

    it('handles thinking-log message from worker', () => {
      const logCallback = vi.fn();
      orchestrator.events.on('thinking-log', logCallback);

      (orchestrator as any).handleWorkerMessage({
        type: 'thinking-log',
        payload: { kind: 'info', label: 'Thinking', detail: '' },
      });

      expect(logCallback).toHaveBeenCalled();
      orchestrator.events.off('thinking-log', logCallback);
    });

    it('handles token-usage message from worker', () => {
      const usageCallback = vi.fn();
      orchestrator.events.on('token-usage', usageCallback);

      (orchestrator as any).handleWorkerMessage({
        type: 'token-usage',
        payload: {
          groupId: 'br:main',
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          contextLimit: 200000,
        },
      });

      expect(usageCallback).toHaveBeenCalled();
      orchestrator.events.off('token-usage', usageCallback);
    });

    it('handles compact-done message from worker', async () => {
      const compactCallback = vi.fn();
      orchestrator.events.on('context-compacted', compactCallback);

      await (orchestrator as any).handleWorkerMessage({
        type: 'compact-done',
        payload: { groupId: 'br:main', summary: 'This is a summary' },
      });

      expect(compactCallback).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'br:main', summary: 'This is a summary' }),
      );
      orchestrator.events.off('context-compacted', compactCallback);
    });

    it('handles webllm-progress message from worker', () => {
      const progressCallback = vi.fn();
      orchestrator.events.on('webllm-progress', progressCallback);

      (orchestrator as any).handleWorkerMessage({
        type: 'webllm-progress',
        payload: { model: 'llama', progress: 50, status: 'downloading' },
      });

      expect(progressCallback).toHaveBeenCalled();
      orchestrator.events.off('webllm-progress', progressCallback);
    });

    it('handles task-created message from worker', async () => {
      await (orchestrator as any).handleWorkerMessage({
        type: 'task-created',
        payload: {
          task: {
            id: 'task-1',
            groupId: 'br:main',
            name: 'Test task',
            cron: '0 * * * *',
            prompt: 'do something',
            enabled: true,
            createdAt: Date.now(),
          },
        },
      });
      // Should not throw — task is saved to DB
    });

    it('invokes agent and posts message to worker', async () => {
      // Reset state to idle
      (orchestrator as any).state = 'idle';
      const postMessageSpy = vi.spyOn((orchestrator as any).agentWorker, 'postMessage');
      const stateCallback = vi.fn();
      orchestrator.events.on('state-change', stateCallback);

      await (orchestrator as any).invokeAgent('br:main', 'test prompt');

      expect(stateCallback).toHaveBeenCalledWith('thinking');
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invoke',
          payload: expect.objectContaining({ groupId: 'br:main' }),
        }),
      );

      orchestrator.events.off('state-change', stateCallback);
      postMessageSpy.mockRestore();
      (orchestrator as any).state = 'idle';
    });

    it('invokes agent with scheduled task prefix', async () => {
      (orchestrator as any).state = 'idle';
      const msgCallback = vi.fn();
      orchestrator.events.on('message', msgCallback);

      await (orchestrator as any).invokeAgent('br:main', '[SCHEDULED TASK] do something');

      expect(msgCallback).toHaveBeenCalled();
      expect(msgCallback.mock.calls[0][0].sender).toBe('Scheduler');
      expect((orchestrator as any).pendingScheduledTasks.has('br:main')).toBe(true);

      orchestrator.events.off('message', msgCallback);
      (orchestrator as any).pendingScheduledTasks.clear();
      (orchestrator as any).state = 'idle';
    });

    it('processQueue emits error when no API key and no local mode', async () => {
      await orchestrator.setApiKey('anthropic', '');
      await orchestrator.setLocalPreference('offline-only');
      await orchestrator.setProviderId('anthropic');
      (orchestrator as any).messageQueue = [{
        id: 'q-1',
        groupId: 'br:main',
        sender: 'User',
        content: 'test',
        timestamp: Date.now(),
        channel: 'browser',
      }];

      const errorCallback = vi.fn();
      orchestrator.events.on('error', errorCallback);

      await (orchestrator as any).processQueue();

      expect(errorCallback).toHaveBeenCalled();
      orchestrator.events.off('error', errorCallback);
      await orchestrator.setApiKey('anthropic', 'my-key');
    });

    it('processQueue proceeds when local preference is always without API keys', async () => {
      await orchestrator.setApiKey('anthropic', '');
      await orchestrator.setLocalPreference('always');
      (orchestrator as any).state = 'idle';
      (orchestrator as any).processing = false;
      (orchestrator as any).messageQueue = [{
        id: 'q-local',
        groupId: 'br:main',
        sender: 'User',
        content: 'test local',
        timestamp: Date.now(),
        channel: 'browser',
      }];

      const postMessageSpy = vi.spyOn((orchestrator as any).agentWorker, 'postMessage');
      const errorCallback = vi.fn();
      orchestrator.events.on('error', errorCallback);

      await (orchestrator as any).processQueue();

      expect(errorCallback).not.toHaveBeenCalled();
      expect(postMessageSpy).toHaveBeenCalled();

      orchestrator.events.off('error', errorCallback);
      postMessageSpy.mockRestore();
      await orchestrator.setApiKey('anthropic', 'my-key');
      await orchestrator.setLocalPreference('offline-only');
      (orchestrator as any).state = 'idle';
      (orchestrator as any).processing = false;
    });

    it('processQueue invokes agent when configured', async () => {
      (orchestrator as any).state = 'idle';
      (orchestrator as any).processing = false;
      (orchestrator as any).messageQueue = [{
        id: 'q-2',
        groupId: 'br:main',
        sender: 'User',
        content: 'hello world',
        timestamp: Date.now(),
        channel: 'browser',
      }];

      const postMessageSpy = vi.spyOn((orchestrator as any).agentWorker, 'postMessage');

      await (orchestrator as any).processQueue();

      expect(postMessageSpy).toHaveBeenCalled();
      postMessageSpy.mockRestore();
      (orchestrator as any).state = 'idle';
      (orchestrator as any).processing = false;
    });

    it('triggers for non-main groups with trigger word', async () => {
      const msgCallback = vi.fn();
      orchestrator.events.on('message', msgCallback);

      await (orchestrator as any).enqueue({
        id: 'test-trigger',
        groupId: 'tg:123',
        sender: 'User',
        content: 'Hey @Andy how are you?',
        timestamp: Date.now(),
        channel: 'telegram',
      });

      expect(msgCallback).toHaveBeenCalled();
      expect(msgCallback.mock.calls[0][0].isTrigger).toBe(true);
      orchestrator.events.off('message', msgCallback);
    });

    // --- enqueue and processQueue ---

    it('enqueues browser main messages without trigger pattern', async () => {
      const msgCallback = vi.fn();
      orchestrator.events.on('message', msgCallback);

      await (orchestrator as any).enqueue({
        id: 'test-1',
        groupId: 'br:main',
        sender: 'User',
        content: 'hello',
        timestamp: Date.now(),
        channel: 'browser',
      });

      expect(msgCallback).toHaveBeenCalled();
      expect(msgCallback.mock.calls[0][0].isTrigger).toBe(true);
      orchestrator.events.off('message', msgCallback);
    });

    it('does not trigger for non-main groups without trigger word', async () => {
      const msgCallback = vi.fn();
      orchestrator.events.on('message', msgCallback);

      await (orchestrator as any).enqueue({
        id: 'test-3',
        groupId: 'tg:123',
        sender: 'User',
        content: 'hello',
        timestamp: Date.now(),
        channel: 'telegram',
      });

      expect(msgCallback).toHaveBeenCalled();
      expect(msgCallback.mock.calls[0][0].isTrigger).toBe(false);
      orchestrator.events.off('message', msgCallback);
    });

    // --- preloadModel ---

    it('preloadModel sends preload message to worker', () => {
      const postMessageSpy = vi.spyOn((orchestrator as any).agentWorker, 'postMessage');
      orchestrator.preloadModel();
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'preload' }),
      );
      postMessageSpy.mockRestore();
    });

    // --- buildProviderConfig ---

    it('returns correct config structure', () => {
      const config = (orchestrator as any).buildProviderConfig();
      expect(config).toHaveProperty('providerId');
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('maxTokens');
      expect(config).toHaveProperty('apiKeys');
      expect(config).toHaveProperty('localPreference');
    });

    // --- shutdown ---

    it('shutdown stops scheduler and telegram', () => {
      orchestrator.shutdown();
    });

    // --- configureTelegram (uses a fresh instance) ---

    it('configures telegram', async () => {
      const orch2 = new Orchestrator();
      await orch2.init();

      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 }))
      );
      vi.stubGlobal('fetch', fetchMock);

      await orch2.configureTelegram('bot-token', ['123']);
      expect(orch2.telegram.isConfigured()).toBe(true);
      orch2.telegram.stop();
      orch2.shutdown();
      vi.restoreAllMocks();
    });
  });
});
