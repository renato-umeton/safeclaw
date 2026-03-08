import { useOrchestratorStore, initOrchestratorStore, getOrchestrator } from '../../src/stores/orchestrator-store';

// Mock DB to prevent real IndexedDB calls during loadHistory
vi.mock('../../src/db', () => ({
  getRecentMessages: vi.fn().mockResolvedValue([]),
  openDatabase: vi.fn().mockResolvedValue(undefined),
}));

describe('useOrchestratorStore', () => {
  beforeEach(() => {
    useOrchestratorStore.setState({
      messages: [],
      isTyping: false,
      toolActivity: null,
      activityLog: [],
      state: 'idle',
      tokenUsage: null,
      error: null,
      activeGroupId: 'br:main',
      ready: false,
    });
  });

  it('has default state', () => {
    const state = useOrchestratorStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isTyping).toBe(false);
    expect(state.state).toBe('idle');
    expect(state.error).toBeNull();
    expect(state.ready).toBe(false);
  });

  it('clearError clears the error', () => {
    useOrchestratorStore.setState({ error: 'something went wrong' });
    useOrchestratorStore.getState().clearError();
    expect(useOrchestratorStore.getState().error).toBeNull();
  });

  it('getOrchestrator throws when not initialized', () => {
    expect(() => getOrchestrator()).toThrow('Orchestrator not initialized');
  });

  describe('initOrchestratorStore', () => {
    it('subscribes to orchestrator events', async () => {
      const mockOrch = {
        events: {
          on: vi.fn(),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      const eventNames = mockOrch.events.on.mock.calls.map((c: any) => c[0]);
      expect(eventNames).toContain('message');
      expect(eventNames).toContain('typing');
      expect(eventNames).toContain('tool-activity');
      expect(eventNames).toContain('thinking-log');
      expect(eventNames).toContain('state-change');
      expect(eventNames).toContain('error');
      expect(eventNames).toContain('session-reset');
      expect(eventNames).toContain('context-compacted');
      expect(eventNames).toContain('token-usage');
      expect(eventNames).toContain('ready');
    });

    it('bridges message events to store state', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      const testMsg = {
        id: 'test-id',
        groupId: 'br:main',
        sender: 'User',
        content: 'Hello',
        timestamp: Date.now(),
        channel: 'browser' as const,
        isFromMe: false,
        isTrigger: false,
      };
      callbacks['message'](testMsg);

      expect(useOrchestratorStore.getState().messages).toContainEqual(testMsg);
    });

    it('bridges typing events', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      callbacks['typing']({ groupId: 'br:main', typing: true });
      expect(useOrchestratorStore.getState().isTyping).toBe(true);

      callbacks['typing']({ groupId: 'br:main', typing: false });
      expect(useOrchestratorStore.getState().isTyping).toBe(false);
    });

    it('bridges error events', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      callbacks['error']({ groupId: 'br:main', error: 'test error' });
      expect(useOrchestratorStore.getState().error).toBe('test error');
    });

    it('resets state on session-reset', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      // Add some state
      useOrchestratorStore.setState({
        messages: [{ id: 'x' } as any],
        isTyping: true,
        tokenUsage: { inputTokens: 10, outputTokens: 5 } as any,
        toolActivity: { tool: 'test', status: 'running' },
      });

      callbacks['session-reset']({ groupId: 'br:main' });
      const state = useOrchestratorStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.isTyping).toBe(false);
      expect(state.tokenUsage).toBeNull();
      expect(state.toolActivity).toBeNull();
      expect(state.activityLog).toEqual([]);
    });

    it('bridges tool-activity events (running)', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      callbacks['tool-activity']({ tool: 'web_search', status: 'running' });
      expect(useOrchestratorStore.getState().toolActivity).toEqual({ tool: 'web_search', status: 'running' });
    });

    it('bridges tool-activity events (done clears activity)', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      callbacks['tool-activity']({ tool: 'web_search', status: 'running' });
      expect(useOrchestratorStore.getState().toolActivity).not.toBeNull();

      callbacks['tool-activity']({ tool: 'web_search', status: 'done' });
      expect(useOrchestratorStore.getState().toolActivity).toBeNull();
    });

    it('bridges thinking-log events and resets on Starting', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      // Add a regular log entry
      const entry1 = { kind: 'info', label: 'Processing', message: 'step 1' };
      callbacks['thinking-log'](entry1);
      expect(useOrchestratorStore.getState().activityLog).toEqual([entry1]);

      // Add another entry
      const entry2 = { kind: 'info', label: 'Processing', message: 'step 2' };
      callbacks['thinking-log'](entry2);
      expect(useOrchestratorStore.getState().activityLog).toEqual([entry1, entry2]);

      // Starting entry resets the log
      const startEntry = { kind: 'info', label: 'Starting', message: 'new invocation' };
      callbacks['thinking-log'](startEntry);
      expect(useOrchestratorStore.getState().activityLog).toEqual([startEntry]);
    });

    it('bridges state-change events and clears toolActivity on idle', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      // Set some tool activity
      useOrchestratorStore.setState({ toolActivity: { tool: 'test', status: 'running' } });

      callbacks['state-change']('processing');
      expect(useOrchestratorStore.getState().state).toBe('processing');
      expect(useOrchestratorStore.getState().toolActivity).toEqual({ tool: 'test', status: 'running' });

      callbacks['state-change']('idle');
      expect(useOrchestratorStore.getState().state).toBe('idle');
      expect(useOrchestratorStore.getState().toolActivity).toBeNull();
    });

    it('bridges token-usage events', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      const usage = { inputTokens: 100, outputTokens: 50 };
      callbacks['token-usage'](usage);
      expect(useOrchestratorStore.getState().tokenUsage).toEqual(usage);
    });

    it('bridges ready events', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      expect(useOrchestratorStore.getState().ready).toBe(false);
      callbacks['ready']();
      expect(useOrchestratorStore.getState().ready).toBe(true);
    });

    it('bridges context-compacted events by reloading history', async () => {
      const { getRecentMessages } = await import('../../src/db');
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      // Reset mock call count from init
      (getRecentMessages as any).mockClear();

      callbacks['context-compacted']();
      expect(getRecentMessages).toHaveBeenCalled();
    });

    it('sendMessage delegates to orchestrator', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      useOrchestratorStore.getState().sendMessage('hello');
      expect(mockOrch.submitMessage).toHaveBeenCalledWith('hello', 'br:main');
    });

    it('newSession delegates to orchestrator', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn().mockResolvedValue(undefined),
        compactContext: vi.fn(),
      } as any;

      await initOrchestratorStore(mockOrch);

      await useOrchestratorStore.getState().newSession();
      expect(mockOrch.newSession).toHaveBeenCalledWith('br:main');
    });

    it('compactContext delegates to orchestrator', async () => {
      const callbacks: Record<string, Function> = {};
      const mockOrch = {
        events: {
          on: vi.fn((event: string, cb: Function) => { callbacks[event] = cb; }),
          off: vi.fn(),
          emit: vi.fn(),
        },
        submitMessage: vi.fn(),
        newSession: vi.fn(),
        compactContext: vi.fn().mockResolvedValue(undefined),
      } as any;

      await initOrchestratorStore(mockOrch);

      await useOrchestratorStore.getState().compactContext();
      expect(mockOrch.compactContext).toHaveBeenCalledWith('br:main');
    });
  });
});
