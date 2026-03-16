import { AnthropicProvider } from '../../src/providers/anthropic';
import { mockFetchResponse, createAnthropicResponse, createAnthropicToolUseResponse } from '../helpers';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider('test-api-key');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct id and name', () => {
    expect(provider.id).toBe('anthropic');
    expect(provider.name).toBe('Anthropic Claude');
    expect(provider.isLocal).toBe(false);
  });

  it('supports tool use', () => {
    expect(provider.supportsToolUse()).toBe(true);
  });

  it('is available when API key is set', async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it('is unavailable when API key is empty', async () => {
    const noKey = new AnthropicProvider('');
    expect(await noKey.isAvailable()).toBe(false);
  });

  it('returns context limits for known models', () => {
    expect(provider.getContextLimit('claude-sonnet-4-6')).toBe(1_000_000);
    expect(provider.getContextLimit('claude-opus-4-6')).toBe(1_000_000);
  });

  it('returns default limit for unknown models', () => {
    expect(provider.getContextLimit('unknown-model')).toBe(200_000);
  });

  describe('chat', () => {
    it('sends request and parses text response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createAnthropicResponse('Hello!'))
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello!' });
      expect(response.stopReason).toBe('end_turn');
      expect(response.usage).toBeDefined();
      expect(response.usage!.inputTokens).toBe(100);
    });

    it('sends correct headers', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createAnthropicResponse('ok'))
      );
      vi.stubGlobal('fetch', fetchMock);

      await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('api.anthropic.com');
      expect(opts.headers['x-api-key']).toBe('test-api-key');
      expect(opts.headers['anthropic-version']).toBe('2023-06-01');
    });

    it('parses tool_use response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createAnthropicToolUseResponse('bash', { command: 'ls' }))
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'list files' }],
        tools: [],
      });

      expect(response.stopReason).toBe('tool_use');
      expect(response.content[0]).toMatchObject({
        type: 'tool_use',
        name: 'bash',
        input: { command: 'ls' },
      });
    });

    it('throws on API error with status code', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse('Rate limited', 429)
      );
      vi.stubGlobal('fetch', fetchMock);

      try {
        await provider.chat({
          model: 'claude-sonnet-4-6',
          maxTokens: 1024,
          system: 'test',
          messages: [{ role: 'user', content: 'hi' }],
        });
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('429');
        expect(err.statusCode).toBe(429);
      }
    });

    it('includes cache token info in usage', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse(createAnthropicResponse('test'))
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.usage!.cacheReadTokens).toBe(10);
      expect(response.usage!.cacheCreationTokens).toBe(5);
    });

    it('passes through unrecognized content block types as-is', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'thinking', thinking: 'some reasoning' },
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 25 },
          model: 'claude-sonnet-4-6',
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.content).toHaveLength(2);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello' });
      // The unrecognized block should be passed through as-is (line 75: return block)
      expect(response.content[1]).toEqual({ type: 'thinking', thinking: 'some reasoning' });
    });

    it('defaults to 0 when usage token counts are missing', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          content: [{ type: 'text', text: 'Hello' }],
          stop_reason: 'end_turn',
          model: 'claude-sonnet-4-6',
          usage: {}, // no token count fields
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.usage!.inputTokens).toBe(0);
      expect(response.usage!.outputTokens).toBe(0);
    });

    it('falls back to request model when response model is absent', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          content: [{ type: 'text', text: 'Hello' }],
          stop_reason: 'end_turn',
          // no model field
          usage: { input_tokens: 10, output_tokens: 5 },
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.model).toBe('claude-sonnet-4-6');
    });

    it('returns undefined usage when usage is absent', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockFetchResponse({
          content: [{ type: 'text', text: 'Hello' }],
          stop_reason: 'end_turn',
          model: 'claude-sonnet-4-6',
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await provider.chat({
        model: 'claude-sonnet-4-6',
        maxTokens: 1024,
        system: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      });

      expect(response.usage).toBeUndefined();
    });
  });
});
