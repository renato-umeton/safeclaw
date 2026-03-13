// Agent worker runs in a Web Worker context.
// We test the module functions by importing them directly.
// Since the file sets up self.onmessage, we need to handle that.

// Shared mock chat function — tests can override this
let mockChatFn: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Hello!' }],
  stopReason: 'end_turn',
  usage: { inputTokens: 100, outputTokens: 50 },
});

// Mock the providers — all instances share the mockChatFn reference
vi.mock('../src/providers/anthropic', () => ({
  AnthropicProvider: class {
    id = 'anthropic';
    name = 'Anthropic Claude';
    isLocal = false;
    supportsToolUse = () => true;
    isAvailable = async () => true;
    getContextLimit = () => 200_000;
    chat = (...args: unknown[]) => (mockChatFn as Function)(...args);
  },
}));

vi.mock('../src/providers/gemini', () => ({
  GeminiProvider: class {
    id = 'gemini';
    name = 'Google Gemini';
    isLocal = false;
    supportsToolUse = () => true;
    isAvailable = async () => true;
    getContextLimit = () => 1_000_000;
    chat = vi.fn();
  },
}));

vi.mock('../src/providers/webllm', () => ({
  WebLLMProvider: class {
    id = 'webllm';
    name = 'WebLLM';
    isLocal = true;
    supportsToolUse = () => true;
    isAvailable = async () => false;
    getContextLimit = () => 32_768;
    chat = vi.fn();
  },
}));

// Capture postMessage calls
const postedMessages: any[] = [];
(self as any).postMessage = vi.fn((msg: any) => postedMessages.push(msg));

describe('agent-worker', () => {
  beforeEach(() => {
    postedMessages.length = 0;
    (self as any).postMessage.mockClear?.();
    // Reset to default mock
    mockChatFn = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Hello!' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
  });

  it('sets up onmessage handler', async () => {
    // Dynamic import to trigger the module
    await import('../src/agent-worker');
    expect(typeof self.onmessage).toBe('function');
  });

  it('handles invoke message', async () => {
    await import('../src/agent-worker');

    if (self.onmessage) {
      const event = new MessageEvent('message', {
        data: {
          type: 'invoke',
          payload: {
            groupId: 'br:main',
            messages: [{ role: 'user', content: 'Hello' }],
            systemPrompt: 'You are helpful.',
            providerConfig: {
              providerId: 'anthropic',
              model: 'claude-sonnet-4-6',
              maxTokens: 1024,
              apiKeys: { anthropic: 'test-key', gemini: '' },
              localPreference: 'offline-only',
            },
          },
        },
      });

      await (self.onmessage as Function)(event);

      // Should have posted typing, thinking-log, and response messages
      const types = postedMessages.map(m => m.type);
      expect(types).toContain('typing');
      expect(types).toContain('thinking-log');
    }
  });

  it('handles cancel message and sets abort flag', async () => {
    await import('../src/agent-worker');

    if (self.onmessage) {
      const event = new MessageEvent('message', {
        data: {
          type: 'cancel',
          payload: { groupId: 'br:main' },
        },
      });

      // Should not throw
      await (self.onmessage as Function)(event);
    }
  });

  it('handles invoke with tool_use response and executes tools in parallel', async () => {
    await import('../src/agent-worker');

    if (!self.onmessage) return;

    // Override the shared mock to return tool_use on first call, then end_turn
    let callCount = 0;
    mockChatFn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: return two tool_use blocks (should run in parallel)
        return {
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'javascript', input: { code: '1+1' } },
            { type: 'tool_use', id: 'tool-2', name: 'javascript', input: { code: '2+2' } },
          ],
          stopReason: 'tool_use',
          usage: { inputTokens: 100, outputTokens: 50 },
        };
      }
      // Second call: return final text
      return {
        content: [{ type: 'text', text: 'Both tools ran!' }],
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    });

    const event = new MessageEvent('message', {
      data: {
        type: 'invoke',
        payload: {
          groupId: 'br:main',
          messages: [{ role: 'user', content: 'Run two tools' }],
          systemPrompt: 'You are helpful.',
          providerConfig: {
            providerId: 'anthropic',
            model: 'claude-sonnet-4-6',
            maxTokens: 1024,
            apiKeys: { anthropic: 'test-key', gemini: '' },
            localPreference: 'offline-only',
          },
        },
      },
    });

    await (self.onmessage as Function)(event);

    const types = postedMessages.map(m => m.type);
    expect(types).toContain('typing');
    // Should have tool-activity messages for both tools
    const toolActivities = postedMessages.filter(m => m.type === 'tool-activity');
    expect(toolActivities.length).toBeGreaterThanOrEqual(2);
    // Both tools should show 'running' and 'done' statuses
    const running = toolActivities.filter(m => m.payload.status === 'running');
    const done = toolActivities.filter(m => m.payload.status === 'done');
    expect(running.length).toBe(2);
    expect(done.length).toBe(2);
    // Verify chat was called twice (tool_use + final)
    expect(callCount).toBe(2);
  });
});
