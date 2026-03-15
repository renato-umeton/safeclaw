// ---------------------------------------------------------------------------
// SafeClaw — Agent Worker
// ---------------------------------------------------------------------------
//
// Runs in a dedicated Web Worker. Owns the LLM provider tool-use loop.
// Communicates with the main thread via postMessage.
//
// Uses the provider abstraction layer to support multiple LLM backends
// (Anthropic, Gemini, WebLLM) through a unified interface.

import type { WorkerInbound, WorkerOutbound, InvokePayload, CompactPayload, ConversationMessage, ThinkingLogEntry, WorkerProviderConfig } from './types.js';
import { TOOL_DEFINITIONS } from './tools.js';
import { FETCH_MAX_RESPONSE, CORS_PROXIES, FETCH_TIMEOUT } from './config.js';
import { readGroupFile, writeGroupFile, listGroupFiles } from './storage.js';
import { executeShell } from './shell.js';
import { ulid } from './ulid.js';
import type { LLMProvider, ChatRequest, ProviderId } from './providers/types.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { WebLLMProvider } from './providers/webllm.js';

// ---------------------------------------------------------------------------
// Provider cache — reuse instances across invocations
// ---------------------------------------------------------------------------

const providerCache = new Map<string, LLMProvider>();

function getOrCreateProvider(config: WorkerProviderConfig): LLMProvider {
  const id = config.providerId as ProviderId;
  const cacheKey = `${id}:${config.apiKeys[id] || ''}`;

  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  let provider: LLMProvider;
  switch (id) {
    case 'anthropic':
      provider = new AnthropicProvider(config.apiKeys.anthropic || '');
      break;
    case 'gemini':
      provider = new GeminiProvider(config.apiKeys.gemini || '');
      break;
    case 'webllm':
      provider = new WebLLMProvider((progress) => {
        post({
          type: 'webllm-progress',
          payload: { model: progress.model, progress: progress.progress, status: progress.status },
        });
      });
      break;
    default:
      throw new Error(`Unsupported provider in worker: ${id}. Chrome AI must run on the main thread.`);
  }

  providerCache.set(cacheKey, provider);
  return provider;
}

// ---------------------------------------------------------------------------
// Cancellation state — one AbortController per active invocation
// ---------------------------------------------------------------------------

let activeAbortController: AbortController | null = null;

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'invoke':
      await handleInvoke(payload as InvokePayload);
      break;
    case 'compact':
      await handleCompact(payload as CompactPayload);
      break;
    case 'preload':
      await handlePreload(payload as { providerConfig: WorkerProviderConfig });
      break;
    case 'cancel':
      handleCancel(payload as { groupId: string });
      break;
  }
};

// ---------------------------------------------------------------------------
// Model preloading — download and cache without invoking the LLM
// ---------------------------------------------------------------------------

async function handlePreload(payload: { providerConfig: WorkerProviderConfig }): Promise<void> {
  const { providerConfig } = payload;
  try {
    const provider = getOrCreateProvider(providerConfig);
    // Trigger model download by calling chat with a minimal request.
    // The WebLLM provider's ensureModel() runs on the first chat() call.
    await provider.chat({
      model: providerConfig.model,
      maxTokens: 1,
      system: 'Reply OK',
      messages: [{ role: 'user', content: 'ping' }],
    });
  } catch {
    // Preload is best-effort — download progress is still emitted
  }
}

// Shell emulator needs no boot — it's pure JS over OPFS

// ---------------------------------------------------------------------------
// Cancellation handler
// ---------------------------------------------------------------------------

function handleCancel(_payload: { groupId: string }): void {
  if (activeAbortController) {
    activeAbortController.abort();
  }
}

// ---------------------------------------------------------------------------
// Agent invocation — tool-use loop
// ---------------------------------------------------------------------------

async function handleInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, providerConfig } = payload;
  const { model, maxTokens } = providerConfig;

  const provider = getOrCreateProvider(providerConfig);

  // Set up cancellation for this invocation
  const abortController = new AbortController();
  activeAbortController = abortController;
  const { signal } = abortController;

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Starting', `Provider: ${provider.name} · Model: ${model} · Max tokens: ${maxTokens}`);

  try {
    let currentMessages: ConversationMessage[] = [...messages];
    let iterations = 0;
    const maxIterations = provider.isLocal ? 10 : 25; // Lower limit for local models

    while (iterations < maxIterations) {
      // Check cancellation before each iteration
      if (signal.aborted) {
        post({ type: 'response', payload: { groupId, text: '(generation stopped by user)' } });
        return;
      }

      iterations++;

      const request: ChatRequest = {
        model,
        maxTokens,
        system: systemPrompt,
        messages: currentMessages,
        tools: provider.supportsToolUse() ? TOOL_DEFINITIONS : undefined,
        signal,
        onToken: provider.isLocal
          ? (text: string) => post({ type: 'streaming-chunk', payload: { groupId, text } })
          : undefined,
      };

      log(groupId, 'api-call', `API call #${iterations}`, `${currentMessages.length} messages in context`);

      const result = await provider.chat(request);

      // Emit token usage
      if (result.usage) {
        post({
          type: 'token-usage',
          payload: {
            groupId,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            cacheReadTokens: result.usage.cacheReadTokens || 0,
            cacheCreationTokens: result.usage.cacheCreationTokens || 0,
            contextLimit: provider.getContextLimit(model),
          },
        });
      }

      // Log any text blocks in the response (intermediate reasoning)
      for (const block of result.content) {
        if (block.type === 'text' && block.text) {
          const preview = block.text.length > 200 ? block.text.slice(0, 200) + '...' : block.text;
          log(groupId, 'text', 'Response text', preview);
        }
      }

      if (result.stopReason === 'tool_use') {
        // Execute all tool calls
        const toolResults = [];
        for (const block of result.content) {
          // Check cancellation between tool calls
          if (signal.aborted) {
            post({ type: 'response', payload: { groupId, text: '(generation stopped by user)' } });
            return;
          }
          if (block.type === 'tool_use') {
            const inputPreview = JSON.stringify(block.input);
            const inputShort = inputPreview.length > 300 ? inputPreview.slice(0, 300) + '...' : inputPreview;
            log(groupId, 'tool-call', `Tool: ${block.name}`, inputShort);

            post({
              type: 'tool-activity',
              payload: { groupId, tool: block.name, status: 'running' },
            });

            const output = await executeTool(block.name, block.input, groupId);

            const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
            const outputShort = outputStr.length > 500 ? outputStr.slice(0, 500) + '...' : outputStr;
            log(groupId, 'tool-result', `Result: ${block.name}`, outputShort);

            post({
              type: 'tool-activity',
              payload: { groupId, tool: block.name, status: 'done' },
            });

            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: typeof output === 'string'
                ? output.slice(0, 100_000)
                : JSON.stringify(output).slice(0, 100_000),
            });
          }
        }

        // Continue the conversation with tool results
        currentMessages.push({ role: 'assistant', content: result.content as any });
        currentMessages.push({ role: 'user', content: toolResults as any });

        // Re-signal typing between tool iterations
        post({ type: 'typing', payload: { groupId } });
      } else {
        // Final response — extract text
        const text = result.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('');

        // Strip internal tags (matching NanoClaw pattern)
        const cleaned = text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();

        post({ type: 'response', payload: { groupId, text: cleaned || '(no response)' } });
        return;
      }
    }

    // If we hit max iterations
    post({
      type: 'response',
      payload: {
        groupId,
        text: `Warning: Reached maximum tool-use iterations (${maxIterations}). Stopping to avoid excessive API usage.`,
      },
    });
  } catch (err: unknown) {
    // If aborted, send a clean stopped message instead of an error
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      post({ type: 'response', payload: { groupId, text: '(generation stopped by user)' } });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = (err as any)?.statusCode;
    post({ type: 'error', payload: { groupId, error: message, errorCode } });
  } finally {
    if (activeAbortController === abortController) {
      activeAbortController = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Context compaction — ask the LLM to summarize the conversation
// ---------------------------------------------------------------------------

async function handleCompact(payload: CompactPayload): Promise<void> {
  const { groupId, messages, systemPrompt, providerConfig } = payload;
  const { model, maxTokens } = providerConfig;

  const provider = getOrCreateProvider(providerConfig);

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Compacting context', `Summarizing ${messages.length} messages`);

  try {
    const compactSystemPrompt = [
      systemPrompt,
      '',
      '## COMPACTION TASK',
      '',
      'The conversation context is getting large. Produce a concise summary of the conversation so far.',
      'Include key facts, decisions, user preferences, and any important context.',
      'The summary will replace the full conversation history to stay within token limits.',
      'Be thorough but concise — aim for the essential information only.',
    ].join('\n');

    const compactMessages: ConversationMessage[] = [
      ...messages,
      {
        role: 'user' as const,
        content: 'Please provide a concise summary of our entire conversation so far. Include all key facts, decisions, code discussed, and important context. This summary will replace the full history.',
      },
    ];

    const request: ChatRequest = {
      model,
      maxTokens: Math.min(maxTokens, 4096),
      system: compactSystemPrompt,
      messages: compactMessages,
      // No tools needed for compaction
    };

    const result = await provider.chat(request);

    const summary = result.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    log(groupId, 'info', 'Compaction complete', `Summary: ${summary.length} chars`);
    post({ type: 'compact-done', payload: { groupId, summary } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: `Compaction failed: ${message}` } });
  }
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  groupId: string,
): Promise<string> {
  try {
    switch (name) {
      case 'bash': {
        const result = await executeShell(
          input.command as string,
          groupId,
          {},
          Math.min((input.timeout as number) || 30, 120),
        );
        let output = result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;
        if (result.exitCode !== 0 && !result.stderr) {
          output += `\n[exit code: ${result.exitCode}]`;
        }
        return output || '(no output)';
      }

      case 'read_file':
        return await readGroupFile(groupId, input.path as string);

      case 'write_file':
        await writeGroupFile(groupId, input.path as string, input.content as string);
        return `Written ${(input.content as string).length} bytes to ${input.path}`;

      case 'list_files': {
        const entries = await listGroupFiles(groupId, (input.path as string) || '.');
        return entries.length > 0 ? entries.join('\n') : '(empty directory)';
      }

      case 'fetch_url': {
        const url = input.url as string;
        const method = (input.method as string) || 'GET';
        const headers = input.headers as Record<string, string> | undefined;
        const reqBody = input.body as string | undefined;

        const fetchRes = await fetchWithCorsProxy(url, { method, headers, body: reqBody });
        const rawText = await fetchRes.text();
        const contentType = fetchRes.headers.get('content-type') || '';
        const status = `[HTTP ${fetchRes.status}]\n`;

        // Strip HTML to reduce token usage
        let body = rawText;
        if (contentType.includes('html') || rawText.trimStart().startsWith('<')) {
          body = stripHtml(rawText);
        }

        return status + body.slice(0, FETCH_MAX_RESPONSE);
      }

      case 'update_memory':
        await writeGroupFile(groupId, 'CLAUDE.md', input.content as string);
        return 'Memory updated successfully.';

      case 'create_task': {
        // Post a dedicated message to the main thread to persist the task
        const taskData = {
          id: ulid(),
          groupId,
          schedule: input.schedule as string,
          prompt: input.prompt as string,
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
        };
        post({ type: 'task-created', payload: { task: taskData } });
        return `Task created successfully.\nSchedule: ${taskData.schedule}\nPrompt: ${taskData.prompt}`;
      }

      case 'javascript': {
        try {
          // Indirect eval: (0, eval)(...) runs in global scope and
          // naturally returns the value of the last expression —
          // no explicit `return` needed.
          const code = input.code as string;
          const result = (0, eval)(`"use strict";\n${code}`);
          if (result === undefined) return '(no return value)';
          if (result === null) return 'null';
          if (typeof result === 'object') {
            try { return JSON.stringify(result, null, 2); } catch { /* fall through */ }
          }
          return String(result);
        } catch (err: unknown) {
          return `JavaScript error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(message: WorkerOutbound): void {
  (self as unknown as Worker).postMessage(message);
}

/**
 * Fetch a URL, falling back through CORS proxy services when a direct
 * browser fetch fails (e.g. due to CORS restrictions on HTML websites).
 *
 * Strategy:
 *   1. Try direct `fetch(url)` — works for CORS-friendly APIs.
 *   2. If that throws a network/CORS error, try each proxy in CORS_PROXIES.
 *   3. Return the first successful Response, or throw the last error.
 *
 * Only GET requests are proxied; non-GET requests with a body cannot be
 * relayed through simple URL-prefix proxies, so they skip the fallback.
 */
export async function fetchWithCorsProxy(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  // Attempt direct fetch first
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    return res;
  } catch (directError) {
    // Only fall back for GET-like requests (proxies only support URL passthrough)
    const method = (init?.method || 'GET').toUpperCase();
    if (method !== 'GET' || CORS_PROXIES.length === 0) {
      throw directError;
    }

    // Try each CORS proxy in order
    let lastError: unknown = directError;
    for (const proxy of CORS_PROXIES) {
      try {
        const proxiedUrl = proxy + encodeURIComponent(url);
        const res = await fetch(proxiedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
        return res;
      } catch (proxyError) {
        lastError = proxyError;
      }
    }
    throw lastError;
  }
}

/**
 * Extract readable text from HTML, stripping tags, scripts, styles, and
 * collapsing whitespace.  Runs in the worker (no DOM), so we use regex.
 */
function stripHtml(html: string): string {
  let text = html;
  // Remove script/style/noscript blocks entirely
  text = text.replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove all tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  return text;
}

function log(
  groupId: string,
  kind: ThinkingLogEntry['kind'],
  label: string,
  detail?: string,
): void {
  post({
    type: 'thinking-log',
    payload: { groupId, kind, timestamp: Date.now(), label, detail },
  });
}
