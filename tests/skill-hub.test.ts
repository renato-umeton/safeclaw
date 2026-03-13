import {
  searchSkills,
  listSkills,
  getSkillDetail,
  sortSkills,
  CLAWHUB_API_BASE,
} from '../src/skill-hub';
import type { HubSkill } from '../src/types';
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

    it('always includes sort=downloads and nonSuspicious=true params', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [], nextCursor: null }),
      );

      await listSkills();
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('sort=downloads');
      expect(url).toContain('nonSuspicious=true');
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

  describe('sortSkills', () => {
    const makeSkill = (name: string, downloads: number): HubSkill => ({
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description: '',
      author: '',
      version: '1.0.0',
      downloads,
      stars: 0,
      createdAt: 0,
      updatedAt: 0,
    });

    it('sorts skills by downloads descending', () => {
      const skills = [
        makeSkill('Low', 10),
        makeSkill('High', 500),
        makeSkill('Medium', 100),
      ];
      const sorted = sortSkills(skills);
      expect(sorted.map(s => s.name)).toEqual(['High', 'Medium', 'Low']);
    });

    it('sorts alphabetically by name when downloads are equal', () => {
      const skills = [
        makeSkill('Zebra', 50),
        makeSkill('Alpha', 50),
        makeSkill('Mango', 50),
      ];
      const sorted = sortSkills(skills);
      expect(sorted.map(s => s.name)).toEqual(['Alpha', 'Mango', 'Zebra']);
    });

    it('uses alphabetical tiebreaker only for equal downloads', () => {
      const skills = [
        makeSkill('Zebra', 100),
        makeSkill('Alpha', 50),
        makeSkill('Beta', 100),
        makeSkill('Gamma', 50),
      ];
      const sorted = sortSkills(skills);
      expect(sorted.map(s => s.name)).toEqual(['Beta', 'Zebra', 'Alpha', 'Gamma']);
    });

    it('returns empty array for empty input', () => {
      expect(sortSkills([])).toEqual([]);
    });

    it('returns single-item array unchanged', () => {
      const skills = [makeSkill('Only', 42)];
      const sorted = sortSkills(skills);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].name).toBe('Only');
    });

    it('does not mutate the original array', () => {
      const skills = [makeSkill('B', 10), makeSkill('A', 20)];
      const original = [...skills];
      sortSkills(skills);
      expect(skills[0].name).toBe(original[0].name);
      expect(skills[1].name).toBe(original[1].name);
    });

    it('is case-insensitive for alphabetical sorting', () => {
      const skills = [
        makeSkill('banana', 50),
        makeSkill('Apple', 50),
        makeSkill('cherry', 50),
      ];
      const sorted = sortSkills(skills);
      expect(sorted.map(s => s.name)).toEqual(['Apple', 'banana', 'cherry']);
    });
  });
});
