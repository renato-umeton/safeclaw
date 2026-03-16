// ---------------------------------------------------------------------------
// Integration test: fetchWithCorsProxy against a local test HTTP server.
// Uses a real HTTP server (not mocked fetch) to verify the fetch pipeline.
// Related: https://github.com/renato-umeton/safeclaw/issues/94
// ---------------------------------------------------------------------------

// @ts-expect-error Node types not available in browser TS config
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
// @ts-expect-error Node types not available in browser TS config
import { type AddressInfo } from 'node:net';

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

// ---------------------------------------------------------------------------
// Local test server — serves deterministic HTML and JSON responses,
// acting as an always-available test website.
// ---------------------------------------------------------------------------

const TEST_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Test Page</title><style>body{margin:0}</style></head>
<body>
<h1>Example Domain</h1>
<p>This is a <strong>test page</strong> for SafeClaw fetch_url integration.</p>
<script>console.log("should be stripped")</script>
<noscript>no js</noscript>
</body>
</html>`;

const TEST_JSON = JSON.stringify({
  headers: { Host: 'localhost' },
  url: 'http://localhost/get',
  status: 'ok',
});

let server: Server;
let baseUrl: string;

/** CORS headers so happy-dom's fetch doesn't block cross-origin requests. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (url === '/html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS });
    res.end(TEST_HTML);
  } else if (url === '/json') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(TEST_JSON);
  } else if (url === '/large') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    // 30KB of text — exceeds FETCH_MAX_RESPONSE (20KB)
    res.end('A'.repeat(30_000));
  } else if (url === '/empty') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('');
  } else if (url === '/500') {
    res.writeHead(500, { 'Content-Type': 'text/plain', ...CORS_HEADERS });
    res.end('Internal Server Error');
  } else if (url === '/redirect') {
    res.writeHead(301, {
      Location: `http://127.0.0.1:${(server.address() as AddressInfo).port}/html`,
      ...CORS_HEADERS,
    });
    res.end();
  } else if (url === '/entities') {
    res.writeHead(200, { 'Content-Type': 'text/html', ...CORS_HEADERS });
    res.end('<p>Tom &amp; Jerry &lt;3&gt; &quot;fun&quot; &#39;yes&#39; &nbsp;</p>');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html', ...CORS_HEADERS });
    res.end(TEST_HTML);
  }
}

beforeAll(async () => {
  server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err: Error | undefined) => (err ? reject(err) : resolve()));
  });
});

describe('fetch_url integration — local test server', () => {
  it('successfully fetches an HTML page and returns a valid response', async () => {
    const response = await fetchWithCorsProxy(`${baseUrl}/html`);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain('Example Domain');
    expect(body.toLowerCase()).toContain('<html');
  });

  it('returns correct content-type header for HTML', async () => {
    const response = await fetchWithCorsProxy(`${baseUrl}/html`);
    const contentType = response.headers.get('content-type') || '';

    expect(contentType).toContain('text/html');
  });

  it('fetches a JSON endpoint successfully', async () => {
    const response = await fetchWithCorsProxy(`${baseUrl}/json`);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    const body = await response.text();
    const json = JSON.parse(body);
    expect(json).toHaveProperty('headers');
    expect(json).toHaveProperty('url');
    expect(json.status).toBe('ok');
  });

  it('handles server error responses without throwing', async () => {
    const response = await fetchWithCorsProxy(`${baseUrl}/500`);

    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain('Internal Server Error');
  });

  it('returns empty body for empty response', async () => {
    const response = await fetchWithCorsProxy(`${baseUrl}/empty`);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe('');
  });

  it('follows redirects to final destination', async () => {
    const response = await fetchWithCorsProxy(`${baseUrl}/redirect`);

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('Example Domain');
  });
});
