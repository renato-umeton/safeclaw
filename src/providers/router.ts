// ---------------------------------------------------------------------------
// SafeClaw — Provider router (Design B: quality-first routing)
// ---------------------------------------------------------------------------
//
// Default: cloud provider. Local models only when:
// 1. User explicitly selected a specific provider
// 2. Browser is offline → WebLLM fallback
// 3. Cloud returned 429 (rate limited) → try alternate cloud, then local
// 4. User preference is "always" for local

import type { LLMProvider, ProviderId, RoutingContext, ModelDownloadProgress } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { WebLLMProvider } from './webllm.js';
import { ChromeAIProvider } from './chrome-ai.js';

export class ProviderRegistry {
  private providers = new Map<ProviderId, LLMProvider>();

  constructor(
    apiKeys: Partial<Record<ProviderId, string>>,
    onWebLLMProgress?: (progress: ModelDownloadProgress) => void,
  ) {
    // Always create all providers — availability is checked dynamically
    if (apiKeys.anthropic) {
      this.providers.set('anthropic', new AnthropicProvider(apiKeys.anthropic));
    }
    if (apiKeys.gemini) {
      this.providers.set('gemini', new GeminiProvider(apiKeys.gemini));
    }
    this.providers.set('webllm', new WebLLMProvider(onWebLLMProgress));
    this.providers.set('chrome-ai', new ChromeAIProvider());
  }

  get(id: ProviderId): LLMProvider | undefined {
    return this.providers.get(id);
  }

  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  async listAvailable(): Promise<LLMProvider[]> {
    const results: LLMProvider[] = [];
    for (const provider of this.providers.values()) {
      if (await provider.isAvailable()) {
        results.push(provider);
      }
    }
    return results;
  }

  getCloudProviders(): LLMProvider[] {
    return [...this.providers.values()].filter((p) => !p.isLocal);
  }

  getLocalProviders(): LLMProvider[] {
    return [...this.providers.values()].filter((p) => p.isLocal);
  }
}

/**
 * Select the best provider based on the routing context.
 * Implements Design B (quality-first) with Design D (user override) escape hatch.
 */
export function selectProvider(
  registry: ProviderRegistry,
  context: RoutingContext,
): LLMProvider {
  // 1. User explicitly selected a provider → use it
  if (context.userPreference !== 'auto') {
    const preferred = registry.get(context.userPreference);
    if (preferred) return preferred;
  }

  // 2. User wants local always → use WebLLM (if tool use needed) or Chrome AI
  if (context.localPreference === 'always') {
    if (context.requiresToolUse) {
      const webllm = registry.get('webllm');
      if (webllm) return webllm;
    } else {
      const chromeAI = registry.get('chrome-ai');
      if (chromeAI) return chromeAI;
      const webllm = registry.get('webllm');
      if (webllm) return webllm;
    }
  }

  // 3. Offline → local fallback
  if (!context.isOnline) {
    if (context.localPreference !== 'off') {
      const webllm = registry.get('webllm');
      if (webllm) return webllm;
    }
    // Even if preference is "off", we have no choice when offline
    const webllm = registry.get('webllm');
    if (webllm) return webllm;
    throw new Error('No providers available while offline. Enable WebLLM for local model support.');
  }

  // 4. Rate limited (429) → try alternate cloud, then local
  if (context.lastErrorCode === 429) {
    // Try the other cloud provider
    const cloudProviders = registry.getCloudProviders();
    for (const p of cloudProviders) {
      // Skip the one that just 429'd — we'll use the user's current preference to determine which
      if (p.id !== context.userPreference) return p;
    }
    // All cloud providers exhausted → local fallback
    const webllm = registry.get('webllm');
    if (webllm) return webllm;
  }

  // 5. Default: first available cloud provider (prefer Anthropic)
  const anthropic = registry.get('anthropic');
  if (anthropic) return anthropic;

  const gemini = registry.get('gemini');
  if (gemini) return gemini;

  // Last resort: local
  const webllm = registry.get('webllm');
  if (webllm) return webllm;

  throw new Error('No LLM providers configured. Add an API key in Settings.');
}
