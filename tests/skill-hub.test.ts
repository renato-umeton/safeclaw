import {
  searchSkills,
  listSkills,
  getSkillDetail,
  CLAWHUB_API_BASE,
} from '../src/skill-hub';
import { mockFetchResponse } from './helpers';

describe('skill-hub', () => {
  // Raw API responses (matching the actual ClawHub API format)
  const rawListItem = {
    slug: 'test-skill',
    displayName: 'Test Skill',
    summary: 'A test skill for unit testing',
    tags: { latest: '1.0.0' },
    stats: { downloads: 42, stars: 5, installsAllTime: 10, installsCurrent: 8, versions: 1, comments: 0 },
    createdAt: 1700000000000,
    updatedAt: 1709000000000,
    latestVersion: { version: '1.0.0', createdAt: 1700000000000, changelog: 'Initial release', license: null },
    metadata: null,
  };

  const rawSearchResult = {
    score: 3.5,
    slug: 'search-skill',
    displayName: 'Search Skill',
    summary: 'Found by search',
    version: '2.0.0',
    updatedAt: 1709000000000,
  };

  const rawDetailResponse = {
    skill: {
      slug: 'test-skill',
      displayName: 'Test Skill',
      summary: 'A test skill for unit testing',
      tags: { latest: '1.0.0' },
      stats: { downloads: 42, stars: 5, installsAllTime: 10, installsCurrent: 8, versions: 1, comments: 0 },
      createdAt: 1700000000000,
      updatedAt: 1709000000000,
    },
    latestVersion: { version: '1.0.0', createdAt: 1700000000000, changelog: 'Initial release', license: null },
    metadata: null,
    owner: { handle: 'tester', displayName: 'Tester', image: 'https://example.com/avatar.png' },
    moderation: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('CLAWHUB_API_BASE', () => {
    it('points to clawhub.ai API v1', () => {
      expect(CLAWHUB_API_BASE).toBe('https://clawhub.ai/api/v1');
    });
  });

  describe('searchSkills', () => {
    it('fetches and normalizes search results', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ results: [rawSearchResult] }),
      );

      const result = await searchSkills('test');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe('search-skill');
      expect(result.items[0].name).toBe('Search Skill');
      expect(result.items[0].description).toBe('Found by search');
      expect(result.items[0].version).toBe('2.0.0');
      expect(result.nextCursor).toBeNull();
    });

    it('encodes the query parameter', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ results: [] }),
      );

      await searchSkills('hello world');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=hello+world'),
        expect.any(Object),
      );
    });

    it('passes limit parameter', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ results: [] }),
      );

      await searchSkills('test', 5);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=5'),
        expect.any(Object),
      );
    });

    it('throws on non-OK response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ error: 'Server error' }, 500),
      );

      await expect(searchSkills('test')).rejects.toThrow('ClawHub API error: 500');
    });

    it('throws on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

      await expect(searchSkills('test')).rejects.toThrow('Network failure');
    });

    it('handles empty results gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ results: [] }),
      );

      const result = await searchSkills('nonexistent');
      expect(result.items).toEqual([]);
    });
  });

  describe('listSkills', () => {
    it('fetches and normalizes a paginated list of skills', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [rawListItem], nextCursor: 'abc123' }),
      );

      const result = await listSkills();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe('test-skill');
      expect(result.items[0].name).toBe('Test Skill');
      expect(result.items[0].description).toBe('A test skill for unit testing');
      expect(result.items[0].version).toBe('1.0.0');
      expect(result.items[0].downloads).toBe(42);
      expect(result.items[0].stars).toBe(5);
      expect(result.nextCursor).toBe('abc123');
    });

    it('passes limit parameter', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [], nextCursor: null }),
      );

      await listSkills({ limit: 10 });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('limit=10');
    });

    it('passes cursor for pagination', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [], nextCursor: null }),
      );

      await listSkills({ cursor: 'page2token' });
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('cursor=page2token');
    });

    it('throws on non-OK response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({}, 403),
      );

      await expect(listSkills()).rejects.toThrow('ClawHub API error: 403');
    });
  });

  describe('getSkillDetail', () => {
    it('fetches and normalizes detail for a specific skill', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(rawDetailResponse),
      );

      const result = await getSkillDetail('test-skill');
      expect(result.slug).toBe('test-skill');
      expect(result.name).toBe('Test Skill');
      expect(result.author).toBe('tester');
      expect(result.changelog).toBe('Initial release');
      expect(result.avatarUrl).toBe('https://example.com/avatar.png');
      expect(result.downloads).toBe(42);
      expect(result.stars).toBe(5);
    });

    it('includes the slug in the URL path', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(rawDetailResponse),
      );

      await getSkillDetail('my-cool-skill');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/skills/my-cool-skill'),
        expect.any(Object),
      );
    });

    it('throws on 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ error: 'Not found' }, 404),
      );

      await expect(getSkillDetail('nonexistent')).rejects.toThrow('ClawHub API error: 404');
    });

    it('throws on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Timeout'));

      await expect(getSkillDetail('test')).rejects.toThrow('Timeout');
    });

    it('handles missing owner gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ ...rawDetailResponse, owner: null }),
      );

      const result = await getSkillDetail('test-skill');
      expect(result.author).toBe('');
      expect(result.avatarUrl).toBe('');
    });

    it('handles missing latestVersion gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ ...rawDetailResponse, latestVersion: null }),
      );

      const result = await getSkillDetail('test-skill');
      expect(result.version).toBe('');
      expect(result.changelog).toBe('');
    });
  });
});
