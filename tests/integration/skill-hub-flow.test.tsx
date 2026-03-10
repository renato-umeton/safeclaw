import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { SkillHubPage } from '../../src/components/skill-hub/SkillHubPage';
import { useSkillHubStore } from '../../src/stores/skill-hub-store';

// Use the REAL store (not mocked) to catch real runtime issues
// Mock only the fetch to avoid network calls

/** Helper: create a raw ClawHub list API response */
function rawListResponse(items: Array<{
  slug: string;
  displayName: string;
  summary: string;
  downloads?: number;
  stars?: number;
  version?: string;
}>, nextCursor: string | null = null) {
  return {
    items: items.map((item) => ({
      slug: item.slug,
      displayName: item.displayName,
      summary: item.summary,
      tags: { latest: item.version || '1.0.0' },
      stats: {
        downloads: item.downloads ?? 0,
        stars: item.stars ?? 0,
        installsAllTime: 0,
        installsCurrent: 0,
        versions: 1,
        comments: 0,
      },
      createdAt: 1700000000000,
      updatedAt: 1709000000000,
      latestVersion: { version: item.version || '1.0.0', createdAt: 1700000000000, changelog: null, license: null },
      metadata: null,
    })),
    nextCursor,
  };
}

/** Helper: create a raw ClawHub search API response */
function rawSearchResponse(results: Array<{
  slug: string;
  displayName: string;
  summary: string;
  version?: string;
}>) {
  return {
    results: results.map((r) => ({
      score: 3.0,
      slug: r.slug,
      displayName: r.displayName,
      summary: r.summary,
      version: r.version || '1.0.0',
      updatedAt: 1709000000000,
    })),
  };
}

/** Helper: create a raw ClawHub detail API response */
function rawDetailResponse(skill: {
  slug: string;
  displayName: string;
  summary: string;
  owner?: string;
  changelog?: string;
}) {
  return {
    skill: {
      slug: skill.slug,
      displayName: skill.displayName,
      summary: skill.summary,
      tags: { latest: '1.0.0' },
      stats: { downloads: 100, stars: 5, installsAllTime: 10, installsCurrent: 8, versions: 1, comments: 0 },
      createdAt: 1700000000000,
      updatedAt: 1709000000000,
    },
    latestVersion: { version: '1.0.0', createdAt: 1700000000000, changelog: skill.changelog || null, license: null },
    metadata: null,
    owner: skill.owner ? { handle: skill.owner, displayName: skill.owner, image: '' } : null,
    moderation: null,
  };
}

function mockJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('SkillHub integration (real store)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset store to initial state
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

  it('renders and loads skills from ClawHub API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse(rawListResponse([
        { slug: 'git-helper', displayName: 'Git Helper', summary: 'Helps with git operations' },
      ])),
    );

    render(
      <MemoryRouter initialEntries={['/skill-hub']}>
        <Routes>
          <Route path="/skill-hub" element={<SkillHubPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Page title should be visible immediately
    expect(screen.getByText('Skill Hub')).toBeInTheDocument();
    expect(screen.getByText(/powered by/i)).toBeInTheDocument();

    // Wait for skills to load
    await waitFor(() => {
      expect(screen.getByText('Git Helper')).toBeInTheDocument();
    });

    expect(screen.getByText('Helps with git operations')).toBeInTheDocument();
  });

  it('handles CORS/network errors gracefully without crashing', async () => {
    // Simulate CORS error (fetch throws TypeError for network errors)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    render(
      <MemoryRouter initialEntries={['/skill-hub']}>
        <Routes>
          <Route path="/skill-hub" element={<SkillHubPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Page should still render
    expect(screen.getByText('Skill Hub')).toBeInTheDocument();

    // Error should be displayed (not crash the app)
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    });
  });

  it('handles 500 errors gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    render(
      <MemoryRouter initialEntries={['/skill-hub']}>
        <Routes>
          <Route path="/skill-hub" element={<SkillHubPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/ClawHub API error: 500/)).toBeInTheDocument();
    });
  });

  it('can search skills after initial load', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // First call: browse (list)
      .mockResolvedValueOnce(
        mockJsonResponse(rawListResponse([])),
      )
      // Second call: search
      .mockResolvedValueOnce(
        mockJsonResponse(rawSearchResponse([
          { slug: 'search-result', displayName: 'Search Result', summary: 'Found by search' },
        ])),
      );

    render(
      <MemoryRouter initialEntries={['/skill-hub']}>
        <Routes>
          <Route path="/skill-hub" element={<SkillHubPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for initial load to complete
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Type search query
    const input = screen.getByPlaceholderText(/search skills/i);
    await userEvent.type(input, 'search');

    // Wait for debounced search
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    }, { timeout: 1000 });

    await waitFor(() => {
      expect(screen.getByText('Search Result')).toBeInTheDocument();
    });
  });

  it('can select a skill and view its detail', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // First call: browse (list)
      .mockResolvedValueOnce(
        mockJsonResponse(rawListResponse([
          { slug: 'detail-test', displayName: 'Detail Test', summary: 'Click me for details' },
        ])),
      )
      // Second call: getSkillDetail
      .mockResolvedValueOnce(
        mockJsonResponse(rawDetailResponse({
          slug: 'detail-test',
          displayName: 'Detail Test',
          summary: 'Click me for details',
          owner: 'test-author',
          changelog: 'Initial release with great features.',
        })),
      );

    render(
      <MemoryRouter initialEntries={['/skill-hub']}>
        <Routes>
          <Route path="/skill-hub" element={<SkillHubPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for skill card to appear
    await waitFor(() => {
      expect(screen.getByText('Detail Test')).toBeInTheDocument();
    });

    // Click the skill card
    await userEvent.click(screen.getByText('Detail Test'));

    // Wait for detail modal
    await waitFor(() => {
      expect(screen.getByText(/npx clawhub@latest install detail-test/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Initial release with great features/)).toBeInTheDocument();
  });
});
