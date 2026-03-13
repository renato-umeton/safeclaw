// ---------------------------------------------------------------------------
// Tests for fetchWithCorsProxy — CORS proxy fallback for fetch_url
// ---------------------------------------------------------------------------

// Mock providers to prevent Web Worker setup side effects
vi.mock('../src/providers/anthropic', () => ({
  AnthropicProvider: class { id = 'anthropic'; },
}));
vi.mock('../src/providers/gemini', () => ({
  GeminiProvider: class { id = 'gemini'; },
}));
vi.mock('../src/providers/webllm', () => ({
  WebLLMProvider: class { id = 'webllm'; },
}));

// Suppress worker postMessage
(self as any).postMessage = vi.fn();

import { fetchWithCorsProxy } from '../src/agent-worker';

describe('fetchWithCorsProxy', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns direct fetch response when CORS allows it', async () => {
    const mockResponse = new Response('{"ok":true}', { status: 200 });
    fetchSpy.mockResolvedValueOnce(mockResponse);

    const res = await fetchWithCorsProxy('https://api.example.com/data');

    expect(res).toBe(mockResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/data', undefined);
  });

  it('falls back to CORS proxy when direct fetch throws', async () => {
    const corsError = new TypeError('Failed to fetch');
    const proxyResponse = new Response('<html>content</html>', { status: 200 });

    fetchSpy
      .mockRejectedValueOnce(corsError)   // direct fetch fails
      .mockResolvedValueOnce(proxyResponse); // first proxy succeeds

    const res = await fetchWithCorsProxy('https://news.ycombinator.com/');

    expect(res).toBe(proxyResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Second call should be through the first CORS proxy
    expect(fetchSpy.mock.calls[1][0]).toContain('allorigins');
    expect(fetchSpy.mock.calls[1][0]).toContain(encodeURIComponent('https://news.ycombinator.com/'));
  });

  it('tries second proxy when first proxy also fails', async () => {
    const corsError = new TypeError('Failed to fetch');
    const proxyResponse = new Response('page content', { status: 200 });

    fetchSpy
      .mockRejectedValueOnce(corsError)     // direct fetch fails
      .mockRejectedValueOnce(corsError)     // first proxy fails
      .mockResolvedValueOnce(proxyResponse); // second proxy succeeds

    const res = await fetchWithCorsProxy('https://example.com/');

    expect(res).toBe(proxyResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[2][0]).toContain('corsproxy');
  });

  it('throws last error when all proxies fail', async () => {
    const corsError = new TypeError('Failed to fetch');
    const proxyError = new TypeError('Proxy unreachable');

    fetchSpy
      .mockRejectedValueOnce(corsError)
      .mockRejectedValueOnce(corsError)
      .mockRejectedValueOnce(proxyError);

    await expect(fetchWithCorsProxy('https://example.com/')).rejects.toThrow('Proxy unreachable');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('does not fall back for non-GET requests', async () => {
    const corsError = new TypeError('Failed to fetch');
    fetchSpy.mockRejectedValueOnce(corsError);

    await expect(
      fetchWithCorsProxy('https://api.example.com/data', {
        method: 'POST',
        body: '{"key":"value"}',
      }),
    ).rejects.toThrow('Failed to fetch');

    // Only the direct fetch should have been attempted
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('passes request init to direct fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    fetchSpy.mockResolvedValueOnce(mockResponse);

    const init = {
      method: 'GET',
      headers: { 'Accept': 'application/json' } as Record<string, string>,
    };
    await fetchWithCorsProxy('https://api.example.com/', init);

    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/', init);
  });

  it('encodes the URL when proxying', async () => {
    const corsError = new TypeError('Failed to fetch');
    const proxyResponse = new Response('ok', { status: 200 });

    fetchSpy
      .mockRejectedValueOnce(corsError)
      .mockResolvedValueOnce(proxyResponse);

    const url = 'https://example.com/path?q=hello world&lang=en';
    await fetchWithCorsProxy(url);

    const proxiedUrl = fetchSpy.mock.calls[1][0] as string;
    expect(proxiedUrl).toContain(encodeURIComponent(url));
  });
});
