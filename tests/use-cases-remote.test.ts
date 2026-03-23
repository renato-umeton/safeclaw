import {
  fetchRemoteUseCases,
  fetchUseCaseDetail,
  parseReadmeUseCases,
  mergeUseCases,
  REMOTE_README_URL,
  REMOTE_USECASES_BASE_URL,
  CACHE_KEY,
  CACHE_TTL_MS,
  DETAIL_CACHE_PREFIX,
} from '../src/use-cases-remote';
import { USE_CASES } from '../src/use-cases';
import type { UseCase } from '../src/types';

// Mock db module for cache operations
const mockGetConfig = vi.fn().mockResolvedValue(undefined);
const mockSetConfig = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/db', () => ({
  getConfig: (...args: any[]) => mockGetConfig(...args),
  setConfig: (...args: any[]) => mockSetConfig(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Sample README markdown matching awesome-openclaw-usecases format
const SAMPLE_README = `# Awesome OpenClaw Use Cases

A curated list of real-world use cases.

## Categories

| Category | Use Case | Description |
|----------|----------|-------------|
| Productivity | Daily Standup Automator | Collect team updates from Slack and compile a daily standup summary automatically |
| Finance | Expense Tracker | Parse receipts and bank statements to categorize and track personal expenses |
| Health | Meal Planner | Generate weekly meal plans based on dietary preferences and nutritional goals |
`;

// Sample README with markdown links in the Use Case column
const SAMPLE_README_WITH_LINKS = `# Awesome OpenClaw Use Cases

| Category | Use Case | Description |
|----------|----------|-------------|
| Social Media | [Daily Reddit Digest](usecases/daily-reddit-digest.md) | Summarize a curated digest of your favourite subreddits |
| Social Media | [X Account Analysis](usecases/x-account-analysis.md) | Get a qualitative analysis of your X account |
| Productivity | [Inbox De-clutter](usecases/inbox-declutter.md) | Summarize newsletters into condensed digests |
`;

// Sample individual use-case markdown file content
const SAMPLE_USECASE_MD = `# Inbox De-clutter

Newsletters can take up the inbox like nothing else.

## Skills you Need
[Gmail OAuth Setup](https://clawhub.ai/kai-jar/gmail-oauth).

## How to Set it Up
1. Install the skill and make sure it works.
2. Instruct OpenClaw:
\`\`\`txt
I want you to run a cron job everyday at 8 p.m. to read all the newsletter emails.
\`\`\`
`;

const SAMPLE_README_NO_TABLE = `# Awesome OpenClaw Use Cases

No table here, just text.
`;

describe('use-cases-remote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue(undefined);
  });

  describe('parseReadmeUseCases', () => {
    it('parses markdown table rows into UseCase objects', () => {
      const result = parseReadmeUseCases(SAMPLE_README);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'remote-daily-standup-automator',
        title: 'Daily Standup Automator',
        description: 'Collect team updates from Slack and compile a daily standup summary automatically',
        category: 'Productivity',
        tags: ['community'],
        difficulty: 'intermediate',
      });
    });

    it('generates unique IDs from titles', () => {
      const result = parseReadmeUseCases(SAMPLE_README);
      const ids = result.map((uc) => uc.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids[0]).toBe('remote-daily-standup-automator');
      expect(ids[1]).toBe('remote-expense-tracker');
    });

    it('returns empty array for README without table', () => {
      const result = parseReadmeUseCases(SAMPLE_README_NO_TABLE);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      expect(parseReadmeUseCases('')).toEqual([]);
    });

    it('skips header row of table', () => {
      const result = parseReadmeUseCases(SAMPLE_README);
      // Should not contain a use case with title "Use Case"
      expect(result.find((uc) => uc.title === 'Use Case')).toBeUndefined();
    });

    it('trims whitespace from parsed fields', () => {
      const md = `| Category | Use Case | Description |
|---|---|---|
|  Spaces  |  Trimmed Title  |  Trimmed description  |`;
      const result = parseReadmeUseCases(md);
      expect(result[0].title).toBe('Trimmed Title');
      expect(result[0].category).toBe('Spaces');
      expect(result[0].description).toBe('Trimmed description');
    });

    it('extracts sourceFile from markdown links in table cells', () => {
      const result = parseReadmeUseCases(SAMPLE_README_WITH_LINKS);
      expect(result[0].title).toBe('Daily Reddit Digest');
      expect(result[0].sourceFile).toBe('daily-reddit-digest.md');
      expect(result[1].sourceFile).toBe('x-account-analysis.md');
      expect(result[2].sourceFile).toBe('inbox-declutter.md');
    });

    it('sets sourceFile to undefined for plain text titles', () => {
      const result = parseReadmeUseCases(SAMPLE_README);
      expect(result[0].sourceFile).toBeUndefined();
    });

    it('strips usecases/ prefix from link targets', () => {
      const md = `| Cat | Name | Desc |
|---|---|---|
| Test | [My Tool](usecases/my-tool.md) | A test tool |`;
      const result = parseReadmeUseCases(md);
      expect(result[0].sourceFile).toBe('my-tool.md');
    });
  });

  describe('mergeUseCases', () => {
    const staticCases: UseCase[] = [
      {
        id: 'auto-email-drafts',
        title: 'Automated Email Draft Generation',
        description: 'Generate polished email drafts.',
        category: 'Automation',
        tags: ['email'],
        difficulty: 'beginner',
      },
    ];

    const remoteCases: UseCase[] = [
      {
        id: 'remote-expense-tracker',
        title: 'Expense Tracker',
        description: 'Track expenses.',
        category: 'Finance',
        tags: ['community'],
        difficulty: 'intermediate',
      },
      {
        id: 'remote-automated-email-draft-generation',
        title: 'Automated Email Draft Generation',
        description: 'Different description but same title.',
        category: 'Automation',
        tags: ['community'],
        difficulty: 'beginner',
      },
    ];

    it('returns static cases when remote is empty', () => {
      const result = mergeUseCases(staticCases, []);
      expect(result).toEqual(staticCases);
    });

    it('appends remote cases not in static list', () => {
      const result = mergeUseCases(staticCases, remoteCases);
      expect(result.find((uc) => uc.id === 'remote-expense-tracker')).toBeDefined();
    });

    it('deduplicates by title (case-insensitive), keeping static version', () => {
      const result = mergeUseCases(staticCases, remoteCases);
      const emailCases = result.filter((uc) =>
        uc.title.toLowerCase() === 'automated email draft generation',
      );
      expect(emailCases).toHaveLength(1);
      expect(emailCases[0].id).toBe('auto-email-drafts'); // static version kept
    });

    it('preserves order: static first, then remote', () => {
      const result = mergeUseCases(staticCases, remoteCases);
      expect(result[0].id).toBe('auto-email-drafts');
      expect(result[result.length - 1].id).toBe('remote-expense-tracker');
    });
  });

  describe('fetchRemoteUseCases', () => {
    it('fetches README from correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_README),
      });

      await fetchRemoteUseCases();
      expect(mockFetch).toHaveBeenCalledWith(REMOTE_README_URL, expect.any(Object));
    });

    it('returns parsed use cases on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_README),
      });

      const result = await fetchRemoteUseCases();
      expect(result.length).toBe(3);
      expect(result[0].title).toBe('Daily Standup Automator');
    });

    it('caches result in config store', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_README),
      });

      await fetchRemoteUseCases();
      expect(mockSetConfig).toHaveBeenCalledWith(
        CACHE_KEY,
        expect.stringContaining('Daily Standup Automator'),
      );
    });

    it('returns cached data when cache is fresh', async () => {
      const cached = {
        fetchedAt: Date.now(),
        useCases: [{ id: 'cached', title: 'Cached', description: 'From cache', category: 'Test', tags: ['community'], difficulty: 'beginner' }],
      };
      mockGetConfig.mockResolvedValue(JSON.stringify(cached));

      const result = await fetchRemoteUseCases();
      expect(result).toEqual(cached.useCases);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('re-fetches when cache is stale', async () => {
      const cached = {
        fetchedAt: Date.now() - CACHE_TTL_MS - 1000,
        useCases: [{ id: 'old', title: 'Old', description: 'Stale', category: 'Test', tags: ['community'], difficulty: 'beginner' }],
      };
      mockGetConfig.mockResolvedValue(JSON.stringify(cached));

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_README),
      });

      const result = await fetchRemoteUseCases();
      expect(mockFetch).toHaveBeenCalled();
      expect(result[0].title).toBe('Daily Standup Automator');
    });

    it('returns empty array on fetch error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchRemoteUseCases();
      expect(result).toEqual([]);
    });

    it('returns empty array on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      const result = await fetchRemoteUseCases();
      expect(result).toEqual([]);
    });

    it('returns stale cache on fetch error if cache exists', async () => {
      const cached = {
        fetchedAt: Date.now() - CACHE_TTL_MS - 1000,
        useCases: [{ id: 'stale', title: 'Stale', description: 'Fallback', category: 'Test', tags: ['community'], difficulty: 'beginner' }],
      };
      mockGetConfig.mockResolvedValue(JSON.stringify(cached));
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchRemoteUseCases();
      expect(result).toEqual(cached.useCases);
    });

    it('uses AbortSignal with timeout', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_README),
      });

      await fetchRemoteUseCases();
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs).toHaveProperty('signal');
    });
  });

  describe('fetchUseCaseDetail', () => {
    it('fetches individual use case markdown from correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_USECASE_MD),
      });

      await fetchUseCaseDetail('inbox-declutter.md');
      expect(mockFetch).toHaveBeenCalledWith(
        REMOTE_USECASES_BASE_URL + 'inbox-declutter.md',
        expect.any(Object),
      );
    });

    it('returns full markdown content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_USECASE_MD),
      });

      const result = await fetchUseCaseDetail('inbox-declutter.md');
      expect(result).toBe(SAMPLE_USECASE_MD);
    });

    it('caches result in config store', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_USECASE_MD),
      });

      await fetchUseCaseDetail('inbox-declutter.md');
      expect(mockSetConfig).toHaveBeenCalledWith(
        DETAIL_CACHE_PREFIX + 'inbox-declutter.md',
        expect.stringContaining('Inbox De-clutter'),
      );
    });

    it('returns cached data when cache is fresh', async () => {
      const cached = {
        fetchedAt: Date.now(),
        markdown: '# Cached Content',
      };
      mockGetConfig.mockResolvedValue(JSON.stringify(cached));

      const result = await fetchUseCaseDetail('inbox-declutter.md');
      expect(result).toBe('# Cached Content');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('re-fetches when cache is stale', async () => {
      const cached = {
        fetchedAt: Date.now() - CACHE_TTL_MS - 1000,
        markdown: '# Stale',
      };
      mockGetConfig.mockResolvedValue(JSON.stringify(cached));
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_USECASE_MD),
      });

      const result = await fetchUseCaseDetail('inbox-declutter.md');
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBe(SAMPLE_USECASE_MD);
    });

    it('returns null on fetch error with no cache', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await fetchUseCaseDetail('inbox-declutter.md');
      expect(result).toBeNull();
    });

    it('returns stale cache on fetch error', async () => {
      const cached = {
        fetchedAt: Date.now() - CACHE_TTL_MS - 1000,
        markdown: '# Stale Fallback',
      };
      mockGetConfig.mockResolvedValue(JSON.stringify(cached));
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchUseCaseDetail('inbox-declutter.md');
      expect(result).toBe('# Stale Fallback');
    });

    it('returns null on non-ok response with no cache', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      const result = await fetchUseCaseDetail('nonexistent.md');
      expect(result).toBeNull();
    });

    it('uses AbortSignal with timeout', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_USECASE_MD),
      });

      await fetchUseCaseDetail('inbox-declutter.md');
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs).toHaveProperty('signal');
    });
  });

  describe('constants', () => {
    it('exports correct README URL', () => {
      expect(REMOTE_README_URL).toContain('awesome-openclaw-usecases');
      expect(REMOTE_README_URL).toContain('raw.githubusercontent.com');
    });

    it('exports cache key', () => {
      expect(typeof CACHE_KEY).toBe('string');
    });

    it('cache TTL is at least 1 hour', () => {
      expect(CACHE_TTL_MS).toBeGreaterThanOrEqual(3_600_000);
    });

    it('exports base URL for individual use-case files', () => {
      expect(REMOTE_USECASES_BASE_URL).toContain('awesome-openclaw-usecases');
      expect(REMOTE_USECASES_BASE_URL).toContain('usecases/');
    });

    it('exports detail cache prefix', () => {
      expect(DETAIL_CACHE_PREFIX).toBe('usecase_detail_');
    });
  });
});
