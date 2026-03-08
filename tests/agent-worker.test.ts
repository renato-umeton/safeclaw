// Agent worker runs in a Web Worker context.
// We test the module functions by importing them directly.
// Since the file sets up self.onmessage, we need to handle that.

// Mock the providers
vi.mock('../src/providers/anthropic', () => ({
  AnthropicProvider: class {
    id = 'anthropic';
    name = 'Anthropic Claude';
    isLocal = false;
    supportsToolUse = () => true;
    isAvailable = async () => true;
    getContextLimit = () => 200_000;
    chat = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Hello!' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
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
  });

  it('sets up onmessage handler', async () => {
    // Dynamic import to trigger the module
    await import('../src/agent-worker');
    expect(typeof self.onmessage).toBe('function');
  });

  it('handles invoke message', async () => {
    // The onmessage handler should be set up
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

  it('handles cancel message without error', async () => {
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
});
