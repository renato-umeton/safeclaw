// ---------------------------------------------------------------------------
// SafeClaw — Chrome built-in AI provider (Gemini Nano)
// ---------------------------------------------------------------------------
//
// Uses Chrome's window.ai.languageModel API for on-device inference.
// Only available on Chrome 127+ with the feature flag enabled.
//
// IMPORTANT: This provider does NOT support tool use. It is suitable only
// for non-tool tasks like summarization, classification, and simple Q&A.
//
// NOTE: window.ai is only available on the main thread, not in Web Workers.
// This provider should be invoked from the orchestrator, not the agent worker.

import type { LLMProvider, ChatRequest, ChatResponse, ChatContentBlock } from './types.js';

// Chrome AI API types (not yet in standard TypeScript libs)
declare global {
  interface WindowOrWorkerGlobalScope {
    ai?: {
      languageModel?: {
        capabilities(): Promise<{ available: 'no' | 'readily' | 'after-download' }>;
        create(options?: { systemPrompt?: string }): Promise<ChromeAISession>;
      };
    };
  }
}

interface ChromeAISession {
  prompt(input: string): Promise<string>;
  destroy(): void;
}

export class ChromeAIProvider implements LLMProvider {
  readonly id = 'chrome-ai' as const;
  readonly name = 'Chrome AI (Gemini Nano)';
  readonly isLocal = true;

  supportsToolUse(): boolean {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const ai = (self as any).ai;
      if (!ai?.languageModel) return false;
      const caps = await ai.languageModel.capabilities();
      return caps.available === 'readily';
    } catch {
      return false;
    }
  }

  getContextLimit(_model: string): number {
    // Gemini Nano has a limited context window
    return 4_096;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const ai = (self as any).ai;
    if (!ai?.languageModel) {
      throw new Error('Chrome AI is not available in this browser.');
    }

    const caps = await ai.languageModel.capabilities();
    if (caps.available !== 'readily') {
      throw new Error(`Chrome AI is not ready (status: ${caps.available}).`);
    }

    // Create a session with the system prompt
    const session: ChromeAISession = await ai.languageModel.create({
      systemPrompt: request.system || undefined,
    });

    try {
      // Flatten all messages into a single prompt
      // (Gemini Nano doesn't support multi-turn conversation natively through this API)
      const prompt = flattenMessages(request.messages);
      const response = await session.prompt(prompt);

      const content: ChatContentBlock[] = [{ type: 'text', text: response }];

      return {
        content,
        stopReason: 'end_turn', // Chrome AI never returns tool_use
        model: 'gemini-nano',
      };
    } finally {
      session.destroy();
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenMessages(messages: any[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      const text = typeof msg.content === 'string'
        ? msg.content
        : (msg.content || [])
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
      return `${role}: ${text}`;
    })
    .join('\n\n');
}
