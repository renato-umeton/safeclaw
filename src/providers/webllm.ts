// ---------------------------------------------------------------------------
// SafeClaw — WebLLM local provider (Qwen3 via WebGPU)
// ---------------------------------------------------------------------------
//
// Uses @mlc-ai/web-llm to run models locally in the browser via WebGPU.
// Qwen3 models put function calls in the content field as JSON, not in
// tool_calls — we parse these into normalized ChatContentBlock format.

import type { LLMProvider, ChatRequest, ChatResponse, ChatContentBlock, TokenUsageInfo, ModelDownloadProgress } from './types.js';
import type { ToolDefinition } from '../types.js';

// WebLLM is dynamically imported to avoid bundling when not used
type WebLLMEngine = any;

const WEBLLM_MODELS: Record<string, { contextWindow: number; mlcId: string }> = {
  'qwen3-4b': { contextWindow: 32_768, mlcId: 'Qwen3-4B-q4f16_1-MLC' },
  'qwen3-30b': { contextWindow: 32_768, mlcId: 'Qwen3-30B-A3B-q4f16_1-MLC' },
};

export class WebLLMProvider implements LLMProvider {
  readonly id = 'webllm' as const;
  readonly name = 'WebLLM (Local)';
  readonly isLocal = true;

  private engine: WebLLMEngine | null = null;
  private currentModelId: string | null = null;
  private loading = false;
  private onProgress?: (progress: ModelDownloadProgress) => void;

  constructor(onProgress?: (progress: ModelDownloadProgress) => void) {
    this.onProgress = onProgress;
  }

  supportsToolUse(): boolean {
    return true; // via content parsing
  }

  async isAvailable(): Promise<boolean> {
    // Check WebGPU support
    if (typeof navigator === 'undefined') return false;
    if (!('gpu' in navigator)) return false;

    // Check minimum device memory (4GB)
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory !== undefined && deviceMemory < 4) return false;

    return true;
  }

  getContextLimit(model: string): number {
    return WEBLLM_MODELS[model]?.contextWindow ?? 32_768;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const modelInfo = WEBLLM_MODELS[request.model];
    if (!modelInfo) {
      throw new Error(`Unknown WebLLM model: ${request.model}`);
    }

    await this.ensureModel(modelInfo.mlcId, request.model);

    // Build messages in OpenAI-compatible format (WebLLM uses OpenAI chat format)
    const messages: any[] = [];

    // System message with tool definitions
    if (request.system) {
      let systemContent = request.system;
      if (request.tools && request.tools.length > 0) {
        systemContent += '\n\n' + buildToolSystemPrompt(request.tools);
      }
      messages.push({ role: 'system', content: systemContent });
    }

    // Conversation messages
    for (const msg of request.messages) {
      if (typeof msg.content === 'string') {
        messages.push({ role: msg.role, content: msg.content });
      } else {
        // Flatten content blocks to text for local models
        const text = msg.content
          .map((block: any) => {
            if (block.type === 'text') return block.text;
            if (block.type === 'tool_use') return `[Tool call: ${block.name}(${JSON.stringify(block.input)})]`;
            if (block.type === 'tool_result') return `[Tool result: ${block.content}]`;
            return '';
          })
          .filter(Boolean)
          .join('\n');
        messages.push({ role: msg.role, content: text });
      }
    }

    const completion = await this.engine.chat.completions.create({
      messages,
      max_tokens: request.maxTokens,
      temperature: 0.7,
    });

    const choice = completion.choices[0];
    const rawContent = choice?.message?.content || '';

    // Parse tool calls from content (Qwen3 embeds them in the text)
    const content = parseToolCallsFromContent(rawContent);

    const hasToolUse = content.some((b) => b.type === 'tool_use');

    const usage: TokenUsageInfo | undefined = completion.usage
      ? {
          inputTokens: completion.usage.prompt_tokens || 0,
          outputTokens: completion.usage.completion_tokens || 0,
        }
      : undefined;

    return {
      content,
      stopReason: hasToolUse ? 'tool_use' : 'end_turn',
      usage,
      model: request.model,
    };
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async ensureModel(mlcModelId: string, displayModel: string): Promise<void> {
    if (this.engine && this.currentModelId === mlcModelId) return;
    if (this.loading) {
      throw new Error('Model is already loading. Please wait.');
    }

    this.loading = true;
    try {
      // Dynamic import to avoid bundling when not needed
      const webllm = await import('@mlc-ai/web-llm');

      const progressCallback = (report: any) => {
        this.onProgress?.({
          providerId: 'webllm',
          model: displayModel,
          progress: report.progress || 0,
          status: report.text || 'Loading...',
        });
      };

      this.engine = await webllm.CreateMLCEngine(mlcModelId, {
        initProgressCallback: progressCallback,
      });
      this.currentModelId = mlcModelId;
    } finally {
      this.loading = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Tool call parsing from content (Qwen3 format)
// ---------------------------------------------------------------------------

/**
 * Qwen3 models emit tool calls in the content as JSON blocks:
 * ```
 * <tool_call>
 * {"name": "tool_name", "arguments": {"arg1": "val1"}}
 * </tool_call>
 * ```
 * We parse these into ChatContentBlock[] format.
 */
function parseToolCallsFromContent(content: string): ChatContentBlock[] {
  const blocks: ChatContentBlock[] = [];
  const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = toolCallRegex.exec(content)) !== null) {
    // Add any text before this tool call
    const textBefore = content.slice(lastIndex, match.index).trim();
    if (textBefore) {
      blocks.push({ type: 'text', text: textBefore });
    }

    // Parse the tool call JSON
    try {
      const parsed = JSON.parse(match[1]);
      blocks.push({
        type: 'tool_use',
        id: `webllm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: parsed.name,
        input: parsed.arguments || {},
      });
    } catch {
      // If JSON parsing fails, treat as text
      blocks.push({ type: 'text', text: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last tool call
  const remaining = content.slice(lastIndex).trim();
  if (remaining) {
    blocks.push({ type: 'text', text: remaining });
  }

  // If no blocks were created, the whole content is text
  if (blocks.length === 0) {
    blocks.push({ type: 'text', text: content });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Tool system prompt for local models
// ---------------------------------------------------------------------------

function buildToolSystemPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map((t) =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.input_schema)}`
  ).join('\n');

  return [
    '## Available Tools',
    '',
    'You can call tools by outputting a <tool_call> block:',
    '<tool_call>',
    '{"name": "tool_name", "arguments": {"param": "value"}}',
    '</tool_call>',
    '',
    'Available tools:',
    toolDescriptions,
    '',
    'Important: Output exactly one <tool_call> block per tool invocation.',
    'After receiving tool results, provide your final answer.',
  ].join('\n');
}
