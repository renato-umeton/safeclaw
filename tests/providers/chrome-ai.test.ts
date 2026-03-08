import { ChromeAIProvider } from '../../src/providers/chrome-ai';

describe('ChromeAIProvider', () => {
  let provider: ChromeAIProvider;

  beforeEach(() => {
    provider = new ChromeAIProvider();
  });

  it('has correct id and name', () => {
    expect(provider.id).toBe('chrome-ai');
    expect(provider.name).toBe('Chrome AI (Gemini Nano)');
    expect(provider.isLocal).toBe(true);
  });

  it('does NOT support tool use', () => {
    expect(provider.supportsToolUse()).toBe(false);
  });

  it('returns context limit of 4096', () => {
    expect(provider.getContextLimit('any')).toBe(4_096);
  });

  describe('isAvailable', () => {
    it('returns false when self.ai is not present', async () => {
      expect(await provider.isAvailable()).toBe(false);
    });

    it('returns true when ai.languageModel reports readily available', async () => {
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
        },
      };
      expect(await provider.isAvailable()).toBe(true);
      delete (self as any).ai;
    });

    it('returns false when ai reports after-download', async () => {
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'after-download' }),
        },
      };
      expect(await provider.isAvailable()).toBe(false);
      delete (self as any).ai;
    });

    it('returns false when capabilities throws', async () => {
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockRejectedValue(new Error('fail')),
        },
      };
      expect(await provider.isAvailable()).toBe(false);
      delete (self as any).ai;
    });
  });

  describe('chat', () => {
    it('throws when ai is not available', async () => {
      await expect(
        provider.chat({
          model: 'gemini-nano',
          maxTokens: 1024,
          system: 'test',
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow('Chrome AI is not available');
    });

    it('sends request and returns response', async () => {
      const mockSession = {
        prompt: vi.fn().mockResolvedValue('Hello from Nano'),
        destroy: vi.fn(),
      };
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession),
        },
      };

      const response = await provider.chat({
        model: 'gemini-nano',
        maxTokens: 1024,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello from Nano' });
      expect(response.stopReason).toBe('end_turn');
      expect(mockSession.destroy).toHaveBeenCalled();
      delete (self as any).ai;
    });

    it('always returns end_turn (no tool use)', async () => {
      const mockSession = {
        prompt: vi.fn().mockResolvedValue('test'),
        destroy: vi.fn(),
      };
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession),
        },
      };

      const response = await provider.chat({
        model: 'gemini-nano',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.stopReason).toBe('end_turn');
      delete (self as any).ai;
    });

    it('flattens content blocks to text', async () => {
      const mockSession = {
        prompt: vi.fn().mockResolvedValue('result'),
        destroy: vi.fn(),
      };
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession),
        },
      };

      await provider.chat({
        model: 'gemini-nano',
        maxTokens: 1024,
        system: 'test',
        messages: [
          { role: 'user', content: 'hello' },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'I will help' }],
          },
        ],
      });

      const promptArg = mockSession.prompt.mock.calls[0][0];
      expect(promptArg).toContain('User: hello');
      expect(promptArg).toContain('Assistant: I will help');
      delete (self as any).ai;
    });

    it('throws when Chrome AI is not ready (status not readily)', async () => {
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'after-download' }),
          create: vi.fn(),
        },
      };

      await expect(
        provider.chat({
          model: 'gemini-nano',
          maxTokens: 1024,
          system: 'test',
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow('Chrome AI is not ready (status: after-download)');
      delete (self as any).ai;
    });

    it('destroys session even when prompt throws', async () => {
      const mockSession = {
        prompt: vi.fn().mockRejectedValue(new Error('prompt failed')),
        destroy: vi.fn(),
      };
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession),
        },
      };

      await expect(
        provider.chat({
          model: 'gemini-nano',
          maxTokens: 1024,
          system: 'test',
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow('prompt failed');

      expect(mockSession.destroy).toHaveBeenCalled();
      delete (self as any).ai;
    });

    it('passes undefined systemPrompt when system is empty', async () => {
      const mockSession = {
        prompt: vi.fn().mockResolvedValue('ok'),
        destroy: vi.fn(),
      };
      const mockCreate = vi.fn().mockResolvedValue(mockSession);
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: mockCreate,
        },
      };

      await provider.chat({
        model: 'gemini-nano',
        maxTokens: 1024,
        system: '',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(mockCreate).toHaveBeenCalledWith({ systemPrompt: undefined });
      delete (self as any).ai;
    });

    it('handles messages with null content in flatten', async () => {
      const mockSession = {
        prompt: vi.fn().mockResolvedValue('ok'),
        destroy: vi.fn(),
      };
      (self as any).ai = {
        languageModel: {
          capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
          create: vi.fn().mockResolvedValue(mockSession),
        },
      };

      await provider.chat({
        model: 'gemini-nano',
        maxTokens: 1024,
        system: 'test',
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: null as any },
        ],
      });

      const promptArg = mockSession.prompt.mock.calls[0][0];
      expect(promptArg).toContain('User: hello');
      expect(promptArg).toContain('Assistant:');
      delete (self as any).ai;
    });
  });
});
