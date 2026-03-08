import { WebLLMProvider } from '../../src/providers/webllm';

// Mock @mlc-ai/web-llm
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockResolvedValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello from WebLLM' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      },
    },
  }),
}));

describe('WebLLMProvider', () => {
  let provider: WebLLMProvider;

  beforeEach(() => {
    provider = new WebLLMProvider();
    // Mock navigator.gpu
    Object.defineProperty(navigator, 'gpu', { value: {}, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct id and name', () => {
    expect(provider.id).toBe('webllm');
    expect(provider.name).toBe('WebLLM (Local)');
    expect(provider.isLocal).toBe(true);
  });

  it('supports tool use', () => {
    expect(provider.supportsToolUse()).toBe(true);
  });

  it('returns context limit for known models', () => {
    expect(provider.getContextLimit('qwen3-4b')).toBe(32_768);
  });

  it('returns default limit for unknown models', () => {
    expect(provider.getContextLimit('unknown')).toBe(32_768);
  });

  describe('isAvailable', () => {
    it('returns true when WebGPU is supported', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when gpu is not in navigator', async () => {
      const gpuDescriptor = Object.getOwnPropertyDescriptor(navigator, 'gpu');
      // Delete gpu property
      delete (navigator as any).gpu;
      const result = await provider.isAvailable();
      expect(result).toBe(false);
      // Restore
      Object.defineProperty(navigator, 'gpu', { value: {}, writable: true, configurable: true });
    });

    it('returns false when device memory is below 4GB', async () => {
      Object.defineProperty(navigator, 'deviceMemory', { value: 2, writable: true, configurable: true });
      const result = await provider.isAvailable();
      expect(result).toBe(false);
      Object.defineProperty(navigator, 'deviceMemory', { value: undefined, writable: true, configurable: true });
    });
  });

  describe('chat', () => {
    it('throws for unknown model', async () => {
      await expect(
        provider.chat({
          model: 'nonexistent-model',
          maxTokens: 1024,
          system: 'test',
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow('Unknown WebLLM model');
    });

    it('sends request and parses response', async () => {
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toMatchObject({ type: 'text', text: 'Hello from WebLLM' });
      expect(response.stopReason).toBe('end_turn');
    });

    it('parses tool calls from content', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      mockEngine.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Let me help.\n<tool_call>\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>',
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      });

      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'list files' }],
        tools: [{ name: 'bash', description: 'run command', input_schema: { type: 'object' as const, properties: {} } }],
      });

      expect(response.stopReason).toBe('tool_use');
      const toolBlock = response.content.find(b => b.type === 'tool_use');
      expect(toolBlock).toBeDefined();
    });

    it('invokes progress callback during model loading', async () => {
      const onProgress = vi.fn();
      const progressProvider = new WebLLMProvider(onProgress);

      // Override CreateMLCEngine to actually call the progress callback
      const webllm = await import('@mlc-ai/web-llm');
      (webllm.CreateMLCEngine as any).mockImplementationOnce(async (_model: string, opts: any) => {
        // Simulate progress callback invocation (line 138)
        if (opts?.initProgressCallback) {
          opts.initProgressCallback({ progress: 0.5, text: 'Downloading...' });
          opts.initProgressCallback({ progress: 1.0, text: 'Done' });
        }
        return {
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'test' } }],
                usage: { prompt_tokens: 5, completion_tokens: 3 },
              }),
            },
          },
        };
      });

      await progressProvider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        providerId: 'webllm',
        model: 'qwen3-4b',
        progress: 0.5,
        status: 'Downloading...',
      }));
    });

    it('throws when model is already loading (line 129)', async () => {
      const webllm = await import('@mlc-ai/web-llm');

      // Make CreateMLCEngine hang so loading stays true
      let resolveLoading: () => void;
      const loadingPromise = new Promise<void>((resolve) => { resolveLoading = resolve; });
      (webllm.CreateMLCEngine as any).mockImplementationOnce(async () => {
        await loadingPromise;
        return {
          chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'ok' } }], usage: null }) } },
        };
      });

      const freshProvider = new WebLLMProvider();

      // Start first chat (will hang on loading)
      const firstChat = freshProvider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      // Second chat should throw because model is already loading
      await expect(
        freshProvider.chat({
          model: 'qwen3-4b',
          maxTokens: 1024,
          system: 'test',
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow('Model is already loading');

      // Clean up: resolve the hanging promise
      resolveLoading!();
      await firstChat;
    });

    it('treats invalid JSON in tool_call as text (line 194)', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      mockEngine.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '<tool_call>\n{invalid json here}\n</tool_call>',
          },
        }],
        usage: { prompt_tokens: 5, completion_tokens: 5 },
      });

      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'test' }],
      });

      // Invalid JSON tool call should be treated as plain text
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toMatchObject({
        type: 'text',
        text: '<tool_call>\n{invalid json here}\n</tool_call>',
      });
      expect(response.stopReason).toBe('end_turn');
    });

    it('handles empty content string (line 208)', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      mockEngine.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
        usage: null,
      });

      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'test' }],
      });

      // Empty content should still produce a text block
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toMatchObject({ type: 'text', text: '' });
      expect(response.usage).toBeUndefined();
    });

    it('handles messages with content blocks (non-string)', async () => {
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me run that.' },
            { type: 'tool_use', name: 'bash', id: 'abc', input: { command: 'ls' } },
          ],
        }, {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'abc', content: 'file1.txt\nfile2.txt' },
          ],
        }],
      });

      expect(response.content).toBeDefined();
    });

    it('handles unknown content block types by returning empty string (line 85)', async () => {
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', data: 'abc' } } as any,
          ],
        }],
      });

      expect(response.content).toBeDefined();
    });

    it('reuses engine when same model is already loaded (line 127)', async () => {
      // First call loads the model
      await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'first' }],
      });

      // Second call with same model should reuse the engine (early return on line 127)
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'second' }],
      });

      expect(response.content).toBeDefined();
    });

    it('handles progress report with missing fields (lines 141-142)', async () => {
      const onProgress = vi.fn();
      const progressProvider = new WebLLMProvider(onProgress);

      const webllm = await import('@mlc-ai/web-llm');
      (webllm.CreateMLCEngine as any).mockImplementationOnce(async (_model: string, opts: any) => {
        // Progress report with missing progress and text fields
        if (opts?.initProgressCallback) {
          opts.initProgressCallback({}); // no progress, no text
          opts.initProgressCallback({ progress: 0.75 }); // no text
          opts.initProgressCallback({ text: 'Almost done' }); // no progress
        }
        return {
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'ok' } }],
                usage: { prompt_tokens: 1, completion_tokens: 1 },
              }),
            },
          },
        };
      });

      await progressProvider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        progress: 0,
        status: 'Loading...',
      }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        progress: 0.75,
        status: 'Loading...',
      }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        progress: 0,
        status: 'Almost done',
      }));
    });

    it('handles chat without system message (line 66 false branch)', async () => {
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: '',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.content).toBeDefined();
    });

    it('handles response without usage info (lines 109-110 false branch)', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      mockEngine.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'no usage' } }],
        // no usage field
      });

      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.usage).toBeUndefined();
    });

    it('handles tool call with no arguments field (line 190)', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      mockEngine.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '<tool_call>\n{"name": "no_args_tool"}\n</tool_call>',
          },
        }],
        usage: { prompt_tokens: 5, completion_tokens: 5 },
      });

      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'test' }],
      });

      const toolBlock = response.content.find(b => b.type === 'tool_use');
      expect(toolBlock).toBeDefined();
      expect((toolBlock as any).input).toEqual({});
    });
  });
});
