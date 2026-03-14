// ---------------------------------------------------------------------------
// SafeClaw — Anthropic Claude provider
// ---------------------------------------------------------------------------

import type { LLMProvider, ChatRequest, ChatResponse, ChatContentBlock, TokenUsageInfo } from './types.js';
import { ANTHROPIC_API_URL, ANTHROPIC_API_VERSION } from '../config.js';

const CONTEXT_LIMITS: Record<string, number> = {
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
};

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  readonly name = 'Anthropic Claude';
  readonly isLocal = false;

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  supportsToolUse(): boolean {
    return true;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  getContextLimit(model: string): number {
    return CONTEXT_LIMITS[model] ?? 200_000;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = {
      model: request.model,
      max_tokens: request.maxTokens,
      cache_control: { type: 'ephemeral' },
      system: request.system,
      messages: request.messages,
      tools: request.tools,
    };

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      const err = new Error(`Anthropic API error ${res.status}: ${errBody}`);
      (err as any).statusCode = res.status;
      throw err;
    }

    const result = await res.json();

    // Normalize content blocks — Anthropic's format is already close to ours
    const content: ChatContentBlock[] = result.content.map((block: any) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text };
      }
      if (block.type === 'tool_use') {
        return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
      }
      return block;
    });

    const usage: TokenUsageInfo | undefined = result.usage
      ? {
          inputTokens: result.usage.input_tokens || 0,
          outputTokens: result.usage.output_tokens || 0,
          cacheReadTokens: result.usage.cache_read_input_tokens || 0,
          cacheCreationTokens: result.usage.cache_creation_input_tokens || 0,
        }
      : undefined;

    return {
      content,
      stopReason: result.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
      usage,
      model: result.model || request.model,
    };
  }
}
