import {
  searchSkills,
  listSkills,
  getSkillDetail,
  CLAWHUB_API_BASE,
} from '../src/skill-hub';
import { mockFetchResponse } from './helpers';
import type { HubSkill, HubSkillDetail } from '../src/types';

describe('skill-hub', () => {
  const mockSkill: HubSkill = {
    slug: 'test-skill',
    name: 'Test Skill',
    description: 'A test skill for unit testing',
    author: 'tester',
    version: '1.0.0',
    downloads: 42,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  };

  const mockDetail: HubSkillDetail = {
    ...mockSkill,
    readme: '# Test Skill\n\nThis is a test skill.',
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
    it('fetches skills matching a query', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [mockSkill], nextCursor: null }),
      );

      const result = await searchSkills('test');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe('test-skill');
      expect(result.nextCursor).toBeNull();
    });

    it('encodes the query parameter', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [], nextCursor: null }),
      );

      await searchSkills('hello world');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=hello+world'),
        expect.any(Object),
      );
    });

    it('passes limit parameter', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [], nextCursor: null }),
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
  });

  describe('listSkills', () => {
    it('fetches a paginated list of skills', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [mockSkill], nextCursor: 'abc123' }),
      );

      const result = await listSkills();
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe('abc123');
    });

    it('passes sort and limit parameters', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse({ items: [], nextCursor: null }),
      );

      await listSkills({ sortBy: 'downloads', limit: 10 });
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
    it('fetches detail for a specific skill by slug', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockDetail),
      );

      const result = await getSkillDetail('test-skill');
      expect(result.slug).toBe('test-skill');
      expect(result.readme).toContain('# Test Skill');
    });

    it('includes the slug in the URL path', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        mockFetchResponse(mockDetail),
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
  });
});
