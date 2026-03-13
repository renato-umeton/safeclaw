// ---------------------------------------------------------------------------
// SafeClaw — Agent Worker
// ---------------------------------------------------------------------------
//
// Runs in a dedicated Web Worker. Owns the LLM provider tool-use loop.
// Communicates with the main thread via postMessage.
//
// Uses the provider abstraction layer to support multiple LLM backends
// (Anthropic, Gemini, WebLLM) through a unified interface.
//
// Multi-threading features:
// - Parallel tool execution: multiple tool_use blocks run concurrently
// - AbortController-based cancellation: cancel in-flight invocations

import type { WorkerInbound, WorkerOutbound, InvokePayload, CompactPayload, ConversationMessage, ThinkingLogEntry, WorkerProviderConfig } from './types.js';
import { TOOL_DEFINITIONS } from './tools.js';
import { FETCH_MAX_RESPONSE } from './config.js';
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
// Cancellation — per-group AbortControllers
// ---------------------------------------------------------------------------

const activeAbortControllers = new Map<string, AbortController>();

function getAbortSignal(groupId: string): AbortSignal {
  // Cancel any existing invocation for this group
  activeAbortControllers.get(groupId)?.abort();

  const controller = new AbortController();
  activeAbortControllers.set(groupId, controller);
  return controller.signal;
}

function cancelGroup(groupId: string): void {
  const controller = activeAbortControllers.get(groupId);
  if (controller) {
    controller.abort();
    activeAbortControllers.delete(groupId);
  }
}

function cleanupAbort(groupId: string): void {
  activeAbortControllers.delete(groupId);
}

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
      cancelGroup(payload.groupId);
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
// Agent invocation — tool-use loop
// ---------------------------------------------------------------------------

async function handleInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, providerConfig } = payload;
  const { model, maxTokens } = providerConfig;

  const provider = getOrCreateProvider(providerConfig);
  const abortSignal = getAbortSignal(groupId);

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Starting', `Provider: ${provider.name} · Model: ${model} · Max tokens: ${maxTokens}`);

  try {
    let currentMessages: ConversationMessage[] = [...messages];
    let iterations = 0;
    const maxIterations = provider.isLocal ? 10 : 25; // Lower limit for local models

    while (iterations < maxIterations) {
      // Check for cancellation before each iteration
      if (abortSignal.aborted) {
        post({ type: 'response', payload: { groupId, text: 'Cancelled.' } });
        cleanupAbort(groupId);
        return;
      }

      iterations++;

      const request: ChatRequest = {
        model,
        maxTokens,
        system: systemPrompt,
        messages: currentMessages,
        tools: provider.supportsToolUse() ? TOOL_DEFINITIONS : undefined,
      };

      log(groupId, 'api-call', `API call #${iterations}`, `${currentMessages.length} messages in context`);

      const result = await provider.chat(request);

      // Check for cancellation after API call
      if (abortSignal.aborted) {
        post({ type: 'response', payload: { groupId, text: 'Cancelled.' } });
        cleanupAbort(groupId);
        return;
      }

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
        // Collect all tool_use blocks
        const toolBlocks = result.content.filter(
          (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
            b.type === 'tool_use',
        );

        // Log and mark all tools as running
        for (const block of toolBlocks) {
          const inputPreview = JSON.stringify(block.input);
          const inputShort = inputPreview.length > 300 ? inputPreview.slice(0, 300) + '...' : inputPreview;
          log(groupId, 'tool-call', `Tool: ${block.name}`, inputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: block.name, status: 'running' },
          });
        }

        // Execute all tool calls in parallel
        const toolPromises = toolBlocks.map(async (block) => {
          const output = await executeTool(block.name, block.input, groupId);

          const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
          const outputShort = outputStr.length > 500 ? outputStr.slice(0, 500) + '...' : outputStr;
          log(groupId, 'tool-result', `Result: ${block.name}`, outputShort);

          post({
            type: 'tool-activity',
            payload: { groupId, tool: block.name, status: 'done' },
          });

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: typeof output === 'string'
              ? output.slice(0, 100_000)
              : JSON.stringify(output).slice(0, 100_000),
          };
        });

        const toolResults = await Promise.all(toolPromises);

        // Check for cancellation after tool execution
        if (abortSignal.aborted) {
          post({ type: 'response', payload: { groupId, text: 'Cancelled.' } });
          cleanupAbort(groupId);
          return;
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
        cleanupAbort(groupId);
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
    cleanupAbort(groupId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = (err as any)?.statusCode;
    post({ type: 'error', payload: { groupId, error: message, errorCode } });
    cleanupAbort(groupId);
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
        const fetchRes = await fetch(input.url as string, {
          method: (input.method as string) || 'GET',
          headers: input.headers as Record<string, string> | undefined,
          body: input.body as string | undefined,
        });
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
