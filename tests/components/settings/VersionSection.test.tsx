// ---------------------------------------------------------------------------
// VersionSection component tests
// ---------------------------------------------------------------------------

import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VersionStatus } from '../../../src/version-checker';

// Mock version-checker module
const mockCheckLatestVersion = vi.fn<(v: string) => Promise<VersionStatus>>();

vi.mock('../../../src/version-checker', () => ({
  checkLatestVersion: (v: string) => mockCheckLatestVersion(v),
}));

// Mock config to provide APP_VERSION
vi.mock('../../../src/config', async () => {
  const actual = await vi.importActual('../../../src/config');
  return { ...actual, APP_VERSION: '2.0.0' };
});

let VersionSection: typeof import('../../../src/components/settings/VersionSection').VersionSection;

beforeAll(async () => {
  const mod = await import('../../../src/components/settings/VersionSection');
  VersionSection = mod.VersionSection;
});

describe('VersionSection', () => {
  beforeEach(() => {
    mockCheckLatestVersion.mockReset();
  });

  it('renders Version heading', async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: '2.0.0',
      latestDate: '2026-03-01T00:00:00Z',
      isUpToDate: true,
      error: null,
    });

    await act(async () => {
      render(<VersionSection />);
    });

    expect(screen.getByText('Version')).toBeInTheDocument();
  });

  it('shows current version', async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: '2.0.0',
      latestDate: null,
      isUpToDate: true,
      error: null,
    });

    await act(async () => {
      render(<VersionSection />);
    });

    await waitFor(() => {
      expect(screen.getByText(/v2\.0\.0/)).toBeInTheDocument();
    });
  });

  it('shows loading state while checking', async () => {
    // Never resolve the promise to keep loading state
    mockCheckLatestVersion.mockReturnValue(new Promise(() => {}));

    render(<VersionSection />);

    expect(screen.getByText(/checking/i)).toBeInTheDocument();
  });

  it('shows up-to-date message when versions match', async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: '2.0.0',
      latestDate: '2026-03-01T00:00:00Z',
      isUpToDate: true,
      error: null,
    });

    await act(async () => {
      render(<VersionSection />);
    });

    await waitFor(() => {
      expect(screen.getByText(/latest version/i)).toBeInTheDocument();
    });
  });

  it('shows update available message when behind', async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: '2.1.0',
      latestDate: '2026-03-05T00:00:00Z',
      isUpToDate: false,
      error: null,
    });

    await act(async () => {
      render(<VersionSection />);
    });

    await waitFor(() => {
      expect(screen.getByText(/update available/i)).toBeInTheDocument();
      expect(screen.getByText(/v2\.1\.0/)).toBeInTheDocument();
    });
  });

  it('shows error state when check fails', async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: null,
      latestDate: null,
      isUpToDate: null,
      error: 'Network error',
    });

    await act(async () => {
      render(<VersionSection />);
    });

    await waitFor(() => {
      expect(screen.getByText(/could not check/i)).toBeInTheDocument();
    });
  });

  it('check again button triggers a new check', async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: '2.0.0',
      latestDate: null,
      isUpToDate: true,
      error: null,
    });

    await act(async () => {
      render(<VersionSection />);
    });

    await waitFor(() => {
      expect(screen.getByText(/latest version/i)).toBeInTheDocument();
    });

    expect(mockCheckLatestVersion).toHaveBeenCalledTimes(1);

    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: '2.1.0',
      latestDate: null,
      isUpToDate: false,
      error: null,
    });

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /check again/i }));
    });

    expect(mockCheckLatestVersion).toHaveBeenCalledTimes(2);
  });

  it('displays release date when available', async () => {
    mockCheckLatestVersion.mockResolvedValue({
      current: '2.0.0',
      latest: '2.0.0',
      latestDate: '2026-03-09T12:00:00Z',
      isUpToDate: true,
      error: null,
    });

    await act(async () => {
      render(<VersionSection />);
    });

    await waitFor(() => {
      // Should show a formatted date
      expect(screen.getByText(/Mar/)).toBeInTheDocument();
    });
  });
});
