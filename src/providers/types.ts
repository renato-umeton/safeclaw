// ---------------------------------------------------------------------------
// SafeClaw — Provider abstraction types
// ---------------------------------------------------------------------------

import type { ConversationMessage, ToolDefinition } from '../types.js';

/** Supported provider identifiers */
export type ProviderId = 'anthropic' | 'gemini' | 'webllm' | 'chrome-ai';

/** A chat request in provider-agnostic format */
export interface ChatRequest {
  model: string;
  maxTokens: number;
  system: string;
  messages: ConversationMessage[];
  tools?: ToolDefinition[];
}

/** A normalized content block in provider-agnostic format */
export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

/** A chat response in provider-agnostic format */
export interface ChatResponse {
  content: ChatContentBlock[];
  stopReason: 'end_turn' | 'tool_use';
  usage?: TokenUsageInfo;
  model: string;
}

/** Token usage from a single API call */
export interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

/** LLM provider interface — all providers must implement this */
export interface LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly isLocal: boolean;

  /** Whether this provider supports tool-use (function calling) */
  supportsToolUse(): boolean;

  /** Check if the provider is currently available (API key set, hardware present, etc.) */
  isAvailable(): Promise<boolean>;

  /** Send a chat request and return the normalized response */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Get the context window limit (in tokens) for a given model */
  getContextLimit(model: string): number;
}

/** Model descriptor for UI display */
export interface ModelInfo {
  id: string;
  name: string;
  providerId: ProviderId;
  contextWindow: number;
}

/** Provider configuration passed from main thread to worker */
export interface ProviderConfig {
  providerId: ProviderId;
  model: string;
  maxTokens: number;
  apiKeys: Partial<Record<ProviderId, string>>;
  localPreference: LocalPreference;
}

/** User preference for local model usage */
export type LocalPreference = 'off' | 'offline-only' | 'always';

/** Routing context for provider selection */
export interface RoutingContext {
  isOnline: boolean;
  lastErrorCode?: number;
  userPreference: ProviderId | 'auto';
  requiresToolUse: boolean;
  localPreference: LocalPreference;
}

/** Progress event for model downloads (WebLLM) */
export interface ModelDownloadProgress {
  providerId: ProviderId;
  model: string;
  progress: number;  // 0-1
  status: string;
}
