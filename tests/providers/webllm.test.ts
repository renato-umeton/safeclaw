import { WebLLMProvider } from '../../src/providers/webllm';

/** Helper: create a mock async iterator that yields streaming chunks */
function createMockStream(chunks: string[], usage?: { prompt_tokens: number; completion_tokens: number }) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < chunks.length) {
            const chunk = chunks[index++];
            return {
              done: false as const,
              value: {
                choices: [{ delta: { content: chunk } }],
                usage: index === chunks.length ? usage : undefined,
              },
            };
          }
          return { done: true as const, value: undefined };
        },
      };
    },
  };
}

/** Helper: mock the create function to return a stream for given content */
function mockStreamResponse(mockCreate: any, content: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  mockCreate.mockImplementationOnce(() => Promise.resolve(createMockStream([content], usage)));
}

// Mock @mlc-ai/web-llm
vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockResolvedValue({
    chat: {
      completions: {
        create: vi.fn().mockImplementation((opts: any) => {
          if (opts?.stream) {
            return Promise.resolve(createMockStream(['Hello', ' from', ' WebLLM'], { prompt_tokens: 10, completion_tokens: 5 }));
          }
          return Promise.resolve({
            choices: [{ message: { content: 'Hello from WebLLM' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          });
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
    expect(provider.getContextLimit('qwen3-0.6b')).toBe(32_768);
    expect(provider.getContextLimit('qwen3-1.7b')).toBe(32_768);
    expect(provider.getContextLimit('qwen3-30b')).toBe(32_768);
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

    it('accepts smaller models (qwen3-0.6b)', async () => {
      const freshProvider = new WebLLMProvider();
      const response = await freshProvider.chat({
        model: 'qwen3-0.6b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(response.content).toBeDefined();
      expect(response.model).toBe('qwen3-0.6b');
    });

    it('accepts smaller models (qwen3-1.7b)', async () => {
      const freshProvider = new WebLLMProvider();
      const response = await freshProvider.chat({
        model: 'qwen3-1.7b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(response.content).toBeDefined();
      expect(response.model).toBe('qwen3-1.7b');
    });

    it('parses tool calls from content', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      mockStreamResponse(
        mockEngine.chat.completions.create,
        'Let me help.\n<tool_call>\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>',
        { prompt_tokens: 10, completion_tokens: 20 },
      );

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
              create: vi.fn().mockResolvedValue(
                createMockStream(['test'], { prompt_tokens: 5, completion_tokens: 3 }),
              ),
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
          chat: { completions: { create: vi.fn().mockResolvedValue(createMockStream(['ok'])) } },
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
      mockStreamResponse(
        mockEngine.chat.completions.create,
        '<tool_call>\n{invalid json here}\n</tool_call>',
        { prompt_tokens: 5, completion_tokens: 5 },
      );

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
      mockStreamResponse(mockEngine.chat.completions.create, '');

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
              create: vi.fn().mockResolvedValue(
                createMockStream(['ok'], { prompt_tokens: 1, completion_tokens: 1 }),
              ),
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
      mockStreamResponse(mockEngine.chat.completions.create, 'no usage');

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
      mockStreamResponse(
        mockEngine.chat.completions.create,
        '<tool_call>\n{"name": "no_args_tool"}\n</tool_call>',
        { prompt_tokens: 5, completion_tokens: 5 },
      );

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

    it('uses streaming and calls onToken callback for each chunk', async () => {
      const onToken = vi.fn();
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        onToken,
      });

      // onToken should be called for each streamed chunk
      expect(onToken).toHaveBeenCalledTimes(3);
      expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onToken).toHaveBeenNthCalledWith(2, ' from');
      expect(onToken).toHaveBeenNthCalledWith(3, ' WebLLM');

      // Full response should be accumulated from stream
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toMatchObject({ type: 'text', text: 'Hello from WebLLM' });
      expect(response.stopReason).toBe('end_turn');
    });

    it('streams tool call content and parses accumulated result', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      const toolContent = 'Let me help.\n<tool_call>\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>';
      const chunks = ['Let me help.\n', '<tool_call>\n{"name":', ' "bash", "arguments": {"command": "ls"}}\n</tool_call>'];
      mockEngine.chat.completions.create.mockImplementationOnce((opts: any) => {
        if (opts?.stream) {
          return Promise.resolve(createMockStream(chunks, { prompt_tokens: 10, completion_tokens: 20 }));
        }
        return Promise.resolve({ choices: [{ message: { content: toolContent } }], usage: { prompt_tokens: 10, completion_tokens: 20 } });
      });

      const onToken = vi.fn();
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'list files' }],
        tools: [{ name: 'bash', description: 'run command', input_schema: { type: 'object' as const, properties: {} } }],
        onToken,
      });

      expect(response.stopReason).toBe('tool_use');
      const toolBlock = response.content.find(b => b.type === 'tool_use');
      expect(toolBlock).toBeDefined();
      expect(onToken).toHaveBeenCalled();
    });

    it('handles streaming with empty delta content', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();
      // Stream with some empty/undefined deltas
      const iterator = {
        [Symbol.asyncIterator]() { return this; },
        index: 0,
        items: [
          { choices: [{ delta: { content: 'Hello' } }] },
          { choices: [{ delta: {} }] },  // no content field
          { choices: [{ delta: { content: '' } }] },  // empty string
          { choices: [{ delta: { content: ' world' } }] },
        ],
        async next() {
          if (this.index < this.items.length) {
            return { done: false, value: this.items[this.index++] };
          }
          return { done: true, value: undefined };
        },
      };
      mockEngine.chat.completions.create.mockImplementationOnce(() => Promise.resolve(iterator));

      const onToken = vi.fn();
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        onToken,
      });

      // Only non-empty deltas should trigger onToken
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
      expect(onToken).toHaveBeenNthCalledWith(2, ' world');
      expect(response.content[0]).toMatchObject({ type: 'text', text: 'Hello world' });
    });

    it('streams without onToken callback (no crash)', async () => {
      // Should work fine without onToken - just accumulates response
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        // no onToken
      });

      expect(response.content[0]).toMatchObject({ type: 'text', text: 'Hello from WebLLM' });
    });

    it('extracts usage from final streaming chunk', async () => {
      const onToken = vi.fn();
      const response = await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        onToken,
      });

      expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    });
  });

  describe('engine configuration', () => {
    it('passes logLevel SILENT to CreateMLCEngine', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const freshProvider = new WebLLMProvider();

      await freshProvider.chat({
        model: 'qwen3-0.6b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(webllm.CreateMLCEngine).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ logLevel: 'SILENT' }),
      );
    });

    it('uses temperature 0.6 for inference', async () => {
      const webllm = await import('@mlc-ai/web-llm');
      const mockEngine = await (webllm.CreateMLCEngine as any)();

      await provider.chat({
        model: 'qwen3-4b',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(mockEngine.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.6 }),
      );
    });
  });
});
