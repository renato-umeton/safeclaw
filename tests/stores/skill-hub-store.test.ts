import { useSkillHubStore } from '../../src/stores/skill-hub-store';
import type { HubSkill } from '../../src/types';

// Mock the skill-hub API module
vi.mock('../../src/skill-hub', () => ({
  searchSkills: vi.fn(),
  listSkills: vi.fn(),
  getSkillDetail: vi.fn(),
}));

import { searchSkills, listSkills, getSkillDetail } from '../../src/skill-hub';

const mockSkill: HubSkill = {
  slug: 'test-skill',
  name: 'Test Skill',
  description: 'A test skill',
  author: 'tester',
  version: '1.0.0',
  downloads: 100,
  stars: 5,
  createdAt: 1700000000000,
  updatedAt: 1709000000000,
};

const mockSkill2: HubSkill = {
  slug: 'another-skill',
  name: 'Another Skill',
  description: 'Another test skill',
  author: 'dev',
  version: '2.0.0',
  downloads: 200,
  stars: 10,
  createdAt: 1705000000000,
  updatedAt: 1709500000000,
};

describe('useSkillHubStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSkillHubStore.setState({
      skills: [],
      loading: false,
      error: null,
      query: '',
      nextCursor: null,
      selectedSkill: null,
      selectedSkillLoading: false,
    });
  });

  it('has correct default state', () => {
    const state = useSkillHubStore.getState();
    expect(state.skills).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.query).toBe('');
    expect(state.nextCursor).toBeNull();
    expect(state.selectedSkill).toBeNull();
    expect(state.selectedSkillLoading).toBe(false);
  });

  describe('browse', () => {
    it('fetches and sets skills list', async () => {
      vi.mocked(listSkills).mockResolvedValueOnce({
        items: [mockSkill, mockSkill2],
        nextCursor: null,
      });

      await useSkillHubStore.getState().browse();

      const state = useSkillHubStore.getState();
      expect(state.skills).toHaveLength(2);
      expect(state.skills[0].slug).toBe('test-skill');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.query).toBe('');
    });

    it('sets loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(listSkills).mockReturnValueOnce(
        new Promise((resolve) => { resolvePromise = resolve; }),
      );

      const promise = useSkillHubStore.getState().browse();
      expect(useSkillHubStore.getState().loading).toBe(true);

      resolvePromise!({ items: [], nextCursor: null });
      await promise;
      expect(useSkillHubStore.getState().loading).toBe(false);
    });

    it('stores nextCursor for pagination', async () => {
      vi.mocked(listSkills).mockResolvedValueOnce({
        items: [mockSkill],
        nextCursor: 'cursor-abc',
      });

      await useSkillHubStore.getState().browse();
      expect(useSkillHubStore.getState().nextCursor).toBe('cursor-abc');
    });

    it('sets error on failure', async () => {
      vi.mocked(listSkills).mockRejectedValueOnce(new Error('API down'));

      await useSkillHubStore.getState().browse();

      const state = useSkillHubStore.getState();
      expect(state.error).toBe('API down');
      expect(state.loading).toBe(false);
    });
  });

  describe('search', () => {
    it('searches skills and stores results', async () => {
      vi.mocked(searchSkills).mockResolvedValueOnce({
        items: [mockSkill],
        nextCursor: null,
      });

      await useSkillHubStore.getState().search('test');

      const state = useSkillHubStore.getState();
      expect(state.skills).toHaveLength(1);
      expect(state.query).toBe('test');
      expect(searchSkills).toHaveBeenCalledWith('test', undefined);
    });

    it('passes limit to searchSkills', async () => {
      vi.mocked(searchSkills).mockResolvedValueOnce({
        items: [],
        nextCursor: null,
      });

      await useSkillHubStore.getState().search('query', 5);
      expect(searchSkills).toHaveBeenCalledWith('query', 5);
    });

    it('sets error on failure', async () => {
      vi.mocked(searchSkills).mockRejectedValueOnce(new Error('Search failed'));

      await useSkillHubStore.getState().search('test');

      expect(useSkillHubStore.getState().error).toBe('Search failed');
      expect(useSkillHubStore.getState().loading).toBe(false);
    });
  });

  describe('loadMore', () => {
    it('appends more skills using cursor', async () => {
      // Set up initial state with a cursor
      useSkillHubStore.setState({
        skills: [mockSkill],
        nextCursor: 'cursor-1',
        query: '',
      });

      vi.mocked(listSkills).mockResolvedValueOnce({
        items: [mockSkill2],
        nextCursor: null,
      });

      await useSkillHubStore.getState().loadMore();

      const state = useSkillHubStore.getState();
      expect(state.skills).toHaveLength(2);
      expect(state.nextCursor).toBeNull();
      expect(listSkills).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'cursor-1' }));
    });

    it('does nothing if no cursor', async () => {
      useSkillHubStore.setState({ nextCursor: null });

      await useSkillHubStore.getState().loadMore();
      expect(listSkills).not.toHaveBeenCalled();
      expect(searchSkills).not.toHaveBeenCalled();
    });

    it('uses search when query is present', async () => {
      useSkillHubStore.setState({
        skills: [mockSkill],
        nextCursor: 'cursor-2',
        query: 'search term',
      });

      vi.mocked(searchSkills).mockResolvedValueOnce({
        items: [mockSkill2],
        nextCursor: null,
      });

      await useSkillHubStore.getState().loadMore();
      expect(searchSkills).toHaveBeenCalled();
    });
  });

  describe('selectSkill', () => {
    it('fetches skill detail and sets selectedSkill', async () => {
      const detail = { ...mockSkill, changelog: 'Initial release', avatarUrl: 'https://example.com/avatar.png' };
      vi.mocked(getSkillDetail).mockResolvedValueOnce(detail);

      await useSkillHubStore.getState().selectSkill('test-skill');

      const state = useSkillHubStore.getState();
      expect(state.selectedSkill).toEqual(detail);
      expect(state.selectedSkillLoading).toBe(false);
    });

    it('sets loading during fetch', async () => {
      let resolvePromise: (value: any) => void;
      vi.mocked(getSkillDetail).mockReturnValueOnce(
        new Promise((resolve) => { resolvePromise = resolve; }),
      );

      const promise = useSkillHubStore.getState().selectSkill('test-skill');
      expect(useSkillHubStore.getState().selectedSkillLoading).toBe(true);

      resolvePromise!({ ...mockSkill, changelog: '', avatarUrl: '' });
      await promise;
      expect(useSkillHubStore.getState().selectedSkillLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      vi.mocked(getSkillDetail).mockRejectedValueOnce(new Error('Not found'));

      await useSkillHubStore.getState().selectSkill('bad-slug');

      expect(useSkillHubStore.getState().error).toBe('Not found');
      expect(useSkillHubStore.getState().selectedSkillLoading).toBe(false);
    });
  });

  describe('clearSelection', () => {
    it('clears selectedSkill', () => {
      useSkillHubStore.setState({
        selectedSkill: { ...mockSkill, changelog: '', avatarUrl: '' },
      });

      useSkillHubStore.getState().clearSelection();
      expect(useSkillHubStore.getState().selectedSkill).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      useSkillHubStore.setState({ error: 'some error' });
      useSkillHubStore.getState().clearError();
      expect(useSkillHubStore.getState().error).toBeNull();
    });
  });
});
