import {
  ASSISTANT_NAME,
  buildTriggerPattern,
  TRIGGER_PATTERN,
  CONTEXT_WINDOW_SIZE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  TELEGRAM_API_BASE,
  TELEGRAM_MAX_LENGTH,
  TELEGRAM_POLL_TIMEOUT,
  SCHEDULER_INTERVAL,
  PROCESS_LOOP_INTERVAL,
  FETCH_MAX_RESPONSE,
  DB_NAME,
  LEGACY_DB_NAME,
  DB_VERSION,
  OPFS_ROOT,
  LEGACY_OPFS_ROOT,
  DEFAULT_GROUP_ID,
  DEFAULT_PROVIDER,
  CONFIG_KEYS,
  APP_URL,
  WEBSITE_URL,
  APP_VERSION,
  CORS_PROXIES,
  FETCH_TIMEOUT,
} from '../src/config';
import pkg from '../package.json' with { type: 'json' };

describe('config constants', () => {
  it('has expected default values', () => {
    expect(ASSISTANT_NAME).toBe('Andy');
    expect(CONTEXT_WINDOW_SIZE).toBe(50);
    expect(DEFAULT_MAX_TOKENS).toBe(8096);
    expect(DEFAULT_MODEL).toBe('claude-sonnet-4-6');
    expect(DEFAULT_PROVIDER).toBe('anthropic');
    expect(DEFAULT_GROUP_ID).toBe('br:main');
    expect(DB_NAME).toBe('safeclaw');
    expect(LEGACY_DB_NAME).toBe('openbrowserclaw');
    expect(DB_VERSION).toBe(1);
    expect(OPFS_ROOT).toBe('safeclaw');
    expect(LEGACY_OPFS_ROOT).toBe('openbrowserclaw');
  });

  it('has valid API endpoints', () => {
    expect(ANTHROPIC_API_URL).toContain('api.anthropic.com');
    expect(ANTHROPIC_API_VERSION).toBe('2023-06-01');
    expect(TELEGRAM_API_BASE).toContain('api.telegram.org');
  });

  it('has valid deployment URLs', () => {
    expect(APP_URL).toBe('https://app-safeclaw.umeton.com');
    expect(WEBSITE_URL).toBe('https://safeclaw.umeton.com');
  });

  it('exports APP_VERSION matching package.json version', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('has sensible Telegram constants', () => {
    expect(TELEGRAM_MAX_LENGTH).toBe(4096);
    expect(TELEGRAM_POLL_TIMEOUT).toBe(30);
  });

  it('has sensible interval values', () => {
    expect(SCHEDULER_INTERVAL).toBe(60_000);
    expect(PROCESS_LOOP_INTERVAL).toBe(100);
    expect(FETCH_MAX_RESPONSE).toBe(20_000);
    expect(Array.isArray(CORS_PROXIES)).toBe(true);
    expect(CORS_PROXIES.length).toBeGreaterThan(0);
    expect(FETCH_TIMEOUT).toBe(15_000);
  });

  it('has all required config keys', () => {
    expect(CONFIG_KEYS.ANTHROPIC_API_KEY).toBe('anthropic_api_key');
    expect(CONFIG_KEYS.GEMINI_API_KEY).toBe('gemini_api_key');
    expect(CONFIG_KEYS.PROVIDER).toBe('provider');
    expect(CONFIG_KEYS.WEBLLM_MODEL).toBe('webllm_model');
    expect(CONFIG_KEYS.LOCAL_PREFERENCE).toBe('local_preference');
    expect(CONFIG_KEYS.TELEGRAM_BOT_TOKEN).toBe('telegram_bot_token');
    expect(CONFIG_KEYS.TELEGRAM_CHAT_IDS).toBe('telegram_chat_ids');
    expect(CONFIG_KEYS.TRIGGER_PATTERN).toBe('trigger_pattern');
    expect(CONFIG_KEYS.MODEL).toBe('model');
    expect(CONFIG_KEYS.MAX_TOKENS).toBe('max_tokens');
    expect(CONFIG_KEYS.PASSPHRASE_SALT).toBe('passphrase_salt');
    expect(CONFIG_KEYS.PASSPHRASE_VERIFY).toBe('passphrase_verify');
    expect(CONFIG_KEYS.ASSISTANT_NAME).toBe('assistant_name');
  });
});

describe('buildTriggerPattern', () => {
  it('matches @Name at start of string', () => {
    const pattern = buildTriggerPattern('Andy');
    expect(pattern.test('@Andy hello')).toBe(true);
  });

  it('matches @Name after space', () => {
    const pattern = buildTriggerPattern('Andy');
    expect(pattern.test('hey @Andy')).toBe(true);
  });

  it('is case-insensitive', () => {
    const pattern = buildTriggerPattern('Andy');
    expect(pattern.test('@andy hello')).toBe(true);
    expect(pattern.test('@ANDY hello')).toBe(true);
  });

  it('does not match partial names', () => {
    const pattern = buildTriggerPattern('Andy');
    expect(pattern.test('@AndyBot')).toBe(false);
  });

  it('escapes special regex characters in name', () => {
    const pattern = buildTriggerPattern('A.B');
    expect(pattern.test('@A.B')).toBe(true);
    expect(pattern.test('@AXB')).toBe(false);
  });

  it('TRIGGER_PATTERN matches default name', () => {
    expect(TRIGGER_PATTERN.test('@Andy hello')).toBe(true);
  });
});
