// ---------------------------------------------------------------------------
// SafeClaw — Google Gemini API provider
// ---------------------------------------------------------------------------

import type { LLMProvider, ChatRequest, ChatResponse, ChatContentBlock, TokenUsageInfo } from './types.js';
import type { ConversationMessage, ContentBlock, ToolDefinition } from '../types.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const CONTEXT_LIMITS: Record<string, number> = {
  'gemini-2.5-pro': 1_048_576,
  'gemini-2.5-flash': 1_048_576,
  'gemini-2.5-flash-lite': 1_048_576,
};

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Google Gemini';
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
    return CONTEXT_LIMITS[model] ?? 1_048_576;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const url = `${GEMINI_API_BASE}/models/${request.model}:generateContent?key=${this.apiKey}`;

    const body = {
      systemInstruction: request.system
        ? { parts: [{ text: request.system }] }
        : undefined,
      contents: convertMessages(request.messages),
      tools: request.tools ? convertTools(request.tools) : undefined,
      generationConfig: {
        maxOutputTokens: request.maxTokens,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      const err = new Error(`Gemini API error ${res.status}: ${errBody}`);
      (err as any).statusCode = res.status;
      throw err;
    }

    const result = await res.json();
    return parseGeminiResponse(result, request.model);
  }
}

// ---------------------------------------------------------------------------
// Message conversion: SafeClaw format → Gemini format
// ---------------------------------------------------------------------------

function convertMessages(messages: ConversationMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else {
      // Content blocks (tool_use, tool_result, text)
      const parts: GeminiPart[] = [];
      for (const block of msg.content as ContentBlock[]) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: block.name,
              args: block.input,
            },
          });
        } else if (block.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: '', // Gemini uses name but we track by ID — we'll fill this in
              response: { content: block.content },
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }
  }

  return contents;
}

// ---------------------------------------------------------------------------
// Tool conversion: SafeClaw ToolDefinition → Gemini function declarations
// ---------------------------------------------------------------------------

function convertTools(tools: ToolDefinition[]): GeminiTool[] {
  return [{
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    })),
  }];
}

// ---------------------------------------------------------------------------
// Response parsing: Gemini format → SafeClaw ChatResponse
// ---------------------------------------------------------------------------

function parseGeminiResponse(result: any, requestModel: string): ChatResponse {
  const candidate = result.candidates?.[0];
  if (!candidate) {
    return {
      content: [{ type: 'text', text: '(no response from Gemini)' }],
      stopReason: 'end_turn',
      model: requestModel,
    };
  }

  const parts: any[] = candidate.content?.parts || [];
  const content: ChatContentBlock[] = [];
  let hasToolUse = false;

  for (const part of parts) {
    if (part.text) {
      content.push({ type: 'text', text: part.text });
    } else if (part.functionCall) {
      hasToolUse = true;
      content.push({
        type: 'tool_use',
        id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      });
    }
  }

  const usage: TokenUsageInfo | undefined = result.usageMetadata
    ? {
        inputTokens: result.usageMetadata.promptTokenCount || 0,
        outputTokens: result.usageMetadata.candidatesTokenCount || 0,
      }
    : undefined;

  return {
    content,
    stopReason: hasToolUse ? 'tool_use' : 'end_turn',
    usage,
    model: requestModel,
  };
}

// ---------------------------------------------------------------------------
// Gemini API types (minimal)
// ---------------------------------------------------------------------------

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { content: string } } };

interface GeminiTool {
  functionDeclarations: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[];
}
