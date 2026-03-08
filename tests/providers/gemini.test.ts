import { GeminiProvider } from '../../src/providers/gemini';
import { mockFetchResponse, createGeminiResponse, createGeminiToolCallResponse } from '../helpers';

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider('test-gemini-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct id and name', () => {
    expect(provider.id).toBe('gemini');
    expect(provider.name).toBe('Google Gemini');
    expect(provider.isLocal).toBe(false);
  });

  it('supports tool use', () => {
    expect(provider.supportsToolUse()).toBe(true);
  });

  it('is available when API key is set', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('is unavailable when API key is empty', async () => {
    const noKey = new GeminiProvider('');
    expect(await noKey.isAvailable()).toBe(false);
  });

  it('returns context limits for known models', () => {
    expect(provider.getContextLimit('gemini-2.0-flash')).toBe(1_048_576);
  });

  it('returns default limit for unknown models', () => {
    expect(provider.getContextLimit('unknown')).toBe(1_048_576);
  });

  describe('chat', () => {
    it('sends request and parses text response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiResponse('Hello from Gemini!'))
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello from Gemini!' });
      expect(response.stopReason).toBe('end_turn');
    });

    it('includes API key in URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiResponse('ok'))
      );
      vi.stubGlobal('fetch', fetchMock);

      await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('key=test-gemini-key');
    });

    it('parses function call response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiToolCallResponse('bash', { command: 'ls' }))
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'list files' }],
        tools: [{ name: 'bash', description: 'run command', input_schema: { type: 'object' as const, properties: {} } }],
      });

      expect(response.stopReason).toBe('tool_use');
      expect(response.content[0]).toMatchObject({
        type: 'tool_use',
        name: 'bash',
      });
    });

    it('handles no candidates in response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({ candidates: [] })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.content[0]).toMatchObject({
        type: 'text',
        text: '(no response from Gemini)',
      });
    });

    it('throws on API error', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse('Forbidden', 403)
      );
      vi.stubGlobal('fetch', fetchMock);

      await expect(
        provider.chat({
          model: 'gemini-2.0-flash',
          maxTokens: 1024,
          system: 'test',
          messages: [{ role: 'user', content: 'hi' }],
        })
      ).rejects.toThrow('403');
    });

    it('parses usage metadata', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiResponse('test'))
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.usage).toBeDefined();
      expect(response.usage!.inputTokens).toBe(100);
      expect(response.usage!.outputTokens).toBe(50);
    });

    it('converts messages with content blocks', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiResponse('ok'))
      );
      vi.stubGlobal('fetch', fetchMock);

      await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [
          { role: 'user', content: 'hello' },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me help' },
              { type: 'tool_use', id: 't1', name: 'bash', input: { command: 'ls' } },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 't1', content: 'file.txt' },
            ],
          },
        ],
      });

      const [, opts] = fetchMock.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.contents).toHaveLength(3);
    });

    it('skips empty parts array from content blocks', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiResponse('ok'))
      );
      vi.stubGlobal('fetch', fetchMock);

      await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [
          { role: 'user', content: 'hello' },
          {
            role: 'assistant',
            // Content blocks that produce no recognized parts (empty array after filtering)
            content: [
              { type: 'image', source: { data: 'base64' } } as any,
            ],
          },
        ],
      });

      const [, opts] = fetchMock.mock.calls[0];
      const body = JSON.parse(opts.body);
      // The unrecognized block produces no parts, so that message should be skipped
      expect(body.contents).toHaveLength(1);
    });

    it('handles missing content.parts in candidate', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          candidates: [{
            content: {},  // no parts field
          }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.content).toHaveLength(0);
      expect(response.stopReason).toBe('end_turn');
    });

    it('handles functionCall with no args', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          candidates: [{
            content: {
              parts: [{ functionCall: { name: 'myTool' } }],
            },
          }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [{ name: 'myTool', description: 'a tool', input_schema: { type: 'object' as const, properties: {} } }],
      });

      expect(response.stopReason).toBe('tool_use');
      expect(response.content[0]).toMatchObject({
        type: 'tool_use',
        name: 'myTool',
        input: {},
      });
    });

    it('returns undefined usage when usageMetadata is absent', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          candidates: [{
            content: { parts: [{ text: 'hello' }] },
          }],
          // No usageMetadata
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.usage).toBeUndefined();
    });

    it('ignores parts that are neither text nor functionCall', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          candidates: [{
            content: {
              parts: [
                { text: 'hello' },
                { inlineData: { mimeType: 'image/png', data: 'base64' } } as any,
              ],
            },
          }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      // Only the text part should be in content, the inlineData part should be skipped
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'hello' });
    });

    it('sends request without system instruction when system is undefined', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiResponse('ok'))
      );
      vi.stubGlobal('fetch', fetchMock);

      await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: undefined as any,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const [, opts] = fetchMock.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.systemInstruction).toBeUndefined();
    });

    it('defaults usage counts to 0 when usageMetadata fields are missing', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          candidates: [{
            content: { parts: [{ text: 'hello' }] },
          }],
          usageMetadata: {},  // present but no promptTokenCount or candidatesTokenCount
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.usage).toBeDefined();
      expect(response.usage!.inputTokens).toBe(0);
      expect(response.usage!.outputTokens).toBe(0);
    });

    it('handles mixed text and functionCall parts', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          candidates: [{
            content: {
              parts: [
                { text: 'Let me call a tool' },
                { functionCall: { name: 'search', args: { query: 'test' } } },
              ],
            },
          }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'search' }],
        tools: [{ name: 'search', description: 'search', input_schema: { type: 'object' as const, properties: {} } }],
      });

      expect(response.content).toHaveLength(2);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Let me call a tool' });
      expect(response.content[1]).toMatchObject({ type: 'tool_use', name: 'search', input: { query: 'test' } });
      expect(response.stopReason).toBe('tool_use');
    });

    it('sends request without tools when tools is undefined', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createGeminiResponse('ok'))
      );
      vi.stubGlobal('fetch', fetchMock);

      await provider.chat({
        model: 'gemini-2.0-flash',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      const [, opts] = fetchMock.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.tools).toBeUndefined();
    });
  });
});
