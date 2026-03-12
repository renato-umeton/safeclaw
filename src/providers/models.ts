// ---------------------------------------------------------------------------
// SafeClaw — Provider & model definitions (shared between Settings and Chat)
// ---------------------------------------------------------------------------

import type { ProviderId } from './types.js';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  isLocal: boolean;
  models: { value: string; label: string }[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    isLocal: false,
    models: [
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    isLocal: false,
    models: [
      { value: 'gemini-2.5-pro-preview-06-05', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    ],
  },
  {
    id: 'webllm',
    label: 'WebLLM (Local)',
    isLocal: true,
    models: [
      { value: 'qwen3-0.6b', label: 'Qwen3 0.6B (400 MB)' },
      { value: 'qwen3-1.7b', label: 'Qwen3 1.7B (1 GB)' },
      { value: 'qwen3-4b', label: 'Qwen3 4B (2.5 GB)' },
      { value: 'qwen3-30b', label: 'Qwen3 30B-A3B (16 GB)' },
    ],
  },
  {
    id: 'chrome-ai',
    label: 'Chrome AI (Gemini Nano)',
    isLocal: true,
    models: [
      { value: 'gemini-nano', label: 'Gemini Nano (built-in)' },
    ],
  },
];

/**
 * Find the display label for a model value string.
 * Returns the model value itself if not found.
 */
export function getModelLabel(modelValue: string): string {
  for (const provider of PROVIDERS) {
    const match = provider.models.find((m) => m.value === modelValue);
    if (match) return match.label;
  }
  return modelValue;
}

/**
 * Find the provider that owns a given model value.
 */
export function getProviderForModel(modelValue: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.models.some((m) => m.value === modelValue));
}
