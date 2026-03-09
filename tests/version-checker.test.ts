// ---------------------------------------------------------------------------
// version-checker tests
// ---------------------------------------------------------------------------

import { compareSemver, checkLatestVersion, GITHUB_RELEASES_URL } from '../src/version-checker';
import type { VersionStatus } from '../src/version-checker';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('2.0.0', '2.0.0')).toBe(0);
  });

  it('returns 1 when a has higher major', () => {
    expect(compareSemver('3.0.0', '2.0.0')).toBe(1);
  });

  it('returns -1 when a has lower major', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
  });

  it('compares minor when major is equal', () => {
    expect(compareSemver('2.1.0', '2.0.0')).toBe(1);
    expect(compareSemver('2.0.0', '2.1.0')).toBe(-1);
  });

  it('compares patch when major and minor are equal', () => {
    expect(compareSemver('2.0.1', '2.0.0')).toBe(1);
    expect(compareSemver('2.0.0', '2.0.1')).toBe(-1);
  });

  it('handles multi-digit version numbers', () => {
    expect(compareSemver('2.10.0', '2.9.0')).toBe(1);
    expect(compareSemver('12.0.0', '3.0.0')).toBe(1);
  });
});

describe('checkLatestVersion', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockGitHubRelease(tagName: string, publishedAt: string) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tag_name: tagName,
        published_at: publishedAt,
      }),
    });
  }

  it('returns isUpToDate true when current matches latest', async () => {
    mockGitHubRelease('v2.0.0', '2026-03-01T00:00:00Z');

    const result = await checkLatestVersion('2.0.0');

    expect(result.current).toBe('2.0.0');
    expect(result.latest).toBe('2.0.0');
    expect(result.latestDate).toBe('2026-03-01T00:00:00Z');
    expect(result.isUpToDate).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns isUpToDate false when current is older', async () => {
    mockGitHubRelease('v2.1.0', '2026-03-05T00:00:00Z');

    const result = await checkLatestVersion('2.0.0');

    expect(result.current).toBe('2.0.0');
    expect(result.latest).toBe('2.1.0');
    expect(result.isUpToDate).toBe(false);
  });

  it('returns isUpToDate true when current is newer (dev build)', async () => {
    mockGitHubRelease('v2.0.0', '2026-03-01T00:00:00Z');

    const result = await checkLatestVersion('2.1.0');

    expect(result.isUpToDate).toBe(true);
  });

  it('strips v prefix from tag_name', async () => {
    mockGitHubRelease('v3.2.1', '2026-03-01T00:00:00Z');

    const result = await checkLatestVersion('3.2.1');

    expect(result.latest).toBe('3.2.1');
    expect(result.isUpToDate).toBe(true);
  });

  it('handles tag_name without v prefix', async () => {
    mockGitHubRelease('3.0.0', '2026-03-01T00:00:00Z');

    const result = await checkLatestVersion('3.0.0');

    expect(result.latest).toBe('3.0.0');
    expect(result.isUpToDate).toBe(true);
  });

  it('returns error when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await checkLatestVersion('2.0.0');

    expect(result.current).toBe('2.0.0');
    expect(result.latest).toBeNull();
    expect(result.latestDate).toBeNull();
    expect(result.isUpToDate).toBeNull();
    expect(result.error).toBe('Network error');
  });

  it('returns error when API returns non-200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await checkLatestVersion('2.0.0');

    expect(result.isUpToDate).toBeNull();
    expect(result.error).toContain('404');
  });

  it('extracts published_at into latestDate', async () => {
    mockGitHubRelease('v2.0.0', '2026-03-09T12:30:00Z');

    const result = await checkLatestVersion('2.0.0');

    expect(result.latestDate).toBe('2026-03-09T12:30:00Z');
  });

  it('calls the correct GitHub API URL', async () => {
    mockGitHubRelease('v2.0.0', '2026-03-01T00:00:00Z');

    await checkLatestVersion('2.0.0');

    expect(globalThis.fetch).toHaveBeenCalledWith(GITHUB_RELEASES_URL);
  });
});
