import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillHubPage } from '../../../src/components/skill-hub/SkillHubPage';
import { useSkillHubStore } from '../../../src/stores/skill-hub-store';
import type { HubSkill, HubSkillDetail } from '../../../src/types';

// Mock the store module
vi.mock('../../../src/stores/skill-hub-store', async () => {
  const zustand = await import('zustand');

  const store = zustand.create(() => ({
    skills: [] as HubSkill[],
    loading: false,
    error: null as string | null,
    query: '',
    nextCursor: null as string | null,
    selectedSkill: null as HubSkillDetail | null,
    selectedSkillLoading: false,
    browse: vi.fn(),
    search: vi.fn(),
    loadMore: vi.fn(),
    selectSkill: vi.fn(),
    clearSelection: vi.fn(),
    clearError: vi.fn(),
  }));

  return { useSkillHubStore: store };
});

const mockSkill: HubSkill = {
  slug: 'test-skill',
  name: 'Test Skill',
  description: 'A great test skill for testing',
  author: 'tester',
  version: '1.0.0',
  downloads: 42,
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

describe('SkillHubPage', () => {
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

  it('renders the page title', () => {
    render(<SkillHubPage />);
    expect(screen.getByText('Skill Hub')).toBeInTheDocument();
  });

  it('calls browse on mount', () => {
    const browse = vi.fn();
    useSkillHubStore.setState({ browse });

    render(<SkillHubPage />);
    expect(browse).toHaveBeenCalled();
  });

  it('shows loading spinner when loading', () => {
    useSkillHubStore.setState({ loading: true });
    render(<SkillHubPage />);
    expect(screen.getByTestId('skill-hub-loading')).toBeInTheDocument();
  });

  it('shows error message when error exists', () => {
    useSkillHubStore.setState({ error: 'Something went wrong' });
    render(<SkillHubPage />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders skill cards', () => {
    useSkillHubStore.setState({ skills: [mockSkill, mockSkill2] });
    render(<SkillHubPage />);
    expect(screen.getByText('Test Skill')).toBeInTheDocument();
    expect(screen.getByText('Another Skill')).toBeInTheDocument();
  });

  it('displays skill metadata on cards', () => {
    useSkillHubStore.setState({ skills: [mockSkill] });
    render(<SkillHubPage />);
    expect(screen.getByText('A great test skill for testing')).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('shows empty state when no skills found', () => {
    useSkillHubStore.setState({ skills: [], loading: false });
    render(<SkillHubPage />);
    expect(screen.getByText(/no skills found/i)).toBeInTheDocument();
  });

  it('triggers search on input', async () => {
    const searchFn = vi.fn();
    useSkillHubStore.setState({ search: searchFn, browse: vi.fn() });

    render(<SkillHubPage />);
    const input = screen.getByPlaceholderText(/search skills/i);

    await userEvent.type(input, 'git');

    // Search is debounced, so wait for it
    await waitFor(() => {
      expect(searchFn).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('calls browse when search is cleared', async () => {
    const browseFn = vi.fn();
    const searchFn = vi.fn();
    useSkillHubStore.setState({ browse: browseFn, search: searchFn, query: 'test' });

    render(<SkillHubPage />);
    const input = screen.getByPlaceholderText(/search skills/i);

    await userEvent.clear(input);

    await waitFor(() => {
      // browse is called on mount + on clear
      expect(browseFn).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('shows Load More button when nextCursor exists', () => {
    useSkillHubStore.setState({
      skills: [mockSkill],
      nextCursor: 'next-page',
    });

    render(<SkillHubPage />);
    expect(screen.getByText(/load more/i)).toBeInTheDocument();
  });

  it('does not show Load More when no cursor', () => {
    useSkillHubStore.setState({
      skills: [mockSkill],
      nextCursor: null,
    });

    render(<SkillHubPage />);
    expect(screen.queryByText(/load more/i)).not.toBeInTheDocument();
  });

  it('calls loadMore on Load More click', async () => {
    const loadMore = vi.fn();
    useSkillHubStore.setState({
      skills: [mockSkill],
      nextCursor: 'next-page',
      loadMore,
    });

    render(<SkillHubPage />);
    await userEvent.click(screen.getByText(/load more/i));
    expect(loadMore).toHaveBeenCalled();
  });

  it('calls selectSkill when a skill card is clicked', async () => {
    const selectSkill = vi.fn();
    useSkillHubStore.setState({ skills: [mockSkill], selectSkill });

    render(<SkillHubPage />);
    await userEvent.click(screen.getByText('Test Skill'));
    expect(selectSkill).toHaveBeenCalledWith('test-skill');
  });

  it('shows skill detail modal when selectedSkill is set', () => {
    useSkillHubStore.setState({
      skills: [mockSkill],
      selectedSkill: { ...mockSkill, changelog: 'Initial release of Test Skill.', avatarUrl: '' },
    });

    render(<SkillHubPage />);
    expect(screen.getByTestId('skill-detail-modal')).toBeInTheDocument();
    expect(screen.getByText(/initial release/i)).toBeInTheDocument();
  });

  it('shows loading state in detail modal', () => {
    useSkillHubStore.setState({
      skills: [mockSkill],
      selectedSkillLoading: true,
    });

    render(<SkillHubPage />);
    expect(screen.getByTestId('skill-detail-loading')).toBeInTheDocument();
  });

  it('calls clearSelection when closing detail modal', async () => {
    const clearSelection = vi.fn();
    useSkillHubStore.setState({
      skills: [mockSkill],
      selectedSkill: { ...mockSkill, changelog: '', avatarUrl: '' },
      clearSelection,
    });

    render(<SkillHubPage />);
    await userEvent.click(screen.getByLabelText(/close/i));
    expect(clearSelection).toHaveBeenCalled();
  });

  it('shows powered-by attribution', () => {
    render(<SkillHubPage />);
    expect(screen.getByText(/powered by/i)).toBeInTheDocument();
    expect(screen.getByText(/clawhub/i)).toBeInTheDocument();
  });
});
