// ---------------------------------------------------------------------------
// SafeClaw — Runtime version checker (GitHub Releases API)
// ---------------------------------------------------------------------------

export interface VersionStatus {
  current: string;
  latest: string | null;
  latestDate: string | null;
  isUpToDate: boolean | null;
  error: string | null;
}

export const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/renato-umeton/safeclaw/releases/latest';

/** Compare two semver strings. Returns -1 if a < b, 0 if equal, 1 if a > b. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

/** Fetch the latest release from GitHub and compare against the current version. */
export async function checkLatestVersion(currentVersion: string): Promise<VersionStatus> {
  try {
    const resp = await fetch(GITHUB_RELEASES_URL);
    if (!resp.ok) {
      return {
        current: currentVersion,
        latest: null,
        latestDate: null,
        isUpToDate: null,
        error: `GitHub API returned ${resp.status}`,
      };
    }

    const data = await resp.json();
    const tagName: string = data.tag_name ?? '';
    const latest = tagName.replace(/^v/, '');
    const latestDate: string | null = data.published_at ?? null;

    return {
      current: currentVersion,
      latest,
      latestDate,
      isUpToDate: compareSemver(currentVersion, latest) >= 0,
      error: null,
    };
  } catch (err) {
    return {
      current: currentVersion,
      latest: null,
      latestDate: null,
      isUpToDate: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
