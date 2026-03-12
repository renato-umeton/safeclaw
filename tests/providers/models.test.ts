import { PROVIDERS, getModelLabel, getProviderForModel } from '../../src/providers/models';

describe('providers/models', () => {
  describe('PROVIDERS', () => {
    it('has at least 4 providers', () => {
      expect(PROVIDERS.length).toBeGreaterThanOrEqual(4);
    });

    it('each provider has an id, label, and models array', () => {
      for (const p of PROVIDERS) {
        expect(p.id).toBeTruthy();
        expect(p.label).toBeTruthy();
        expect(Array.isArray(p.models)).toBe(true);
        expect(p.models.length).toBeGreaterThan(0);
      }
    });

    it('each model has a value and label', () => {
      for (const p of PROVIDERS) {
        for (const m of p.models) {
          expect(m.value).toBeTruthy();
          expect(m.label).toBeTruthy();
        }
      }
    });
  });

  describe('getModelLabel', () => {
    it('returns the display label for a known model', () => {
      expect(getModelLabel('claude-sonnet-4-6')).toBe('Claude Sonnet 4.6');
    });

    it('returns the model value itself for an unknown model', () => {
      expect(getModelLabel('unknown-model')).toBe('unknown-model');
    });

    it('finds models across different providers', () => {
      expect(getModelLabel('gemini-2.0-flash')).toBe('Gemini 2.0 Flash');
      expect(getModelLabel('qwen3-4b')).toBe('Qwen3 4B (2.5 GB)');
    });
  });

  describe('getProviderForModel', () => {
    it('returns the provider for a known model', () => {
      const provider = getProviderForModel('claude-sonnet-4-6');
      expect(provider?.id).toBe('anthropic');
    });

    it('returns undefined for an unknown model', () => {
      expect(getProviderForModel('unknown-model')).toBeUndefined();
    });

    it('finds providers for models across different providers', () => {
      expect(getProviderForModel('gemini-2.0-flash')?.id).toBe('gemini');
      expect(getProviderForModel('qwen3-4b')?.id).toBe('webllm');
      expect(getProviderForModel('gemini-nano')?.id).toBe('chrome-ai');
    });
  });
});
