// ---------------------------------------------------------------------------
// UpdateToast component tests
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the usePwaUpdate hook
const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
const mockDismissUpdate = vi.fn();
let mockNeedRefresh = false;
let mockOfflineReady = false;
let mockCountdown: number | null = null;

vi.mock('../../../src/hooks/use-pwa-update.js', () => ({
  usePwaUpdate: () => ({
    needRefresh: mockNeedRefresh,
    offlineReady: mockOfflineReady,
    updateServiceWorker: mockUpdateServiceWorker,
    dismissUpdate: mockDismissUpdate,
    countdown: mockCountdown,
  }),
}));

let UpdateToast: typeof import('../../../src/components/pwa/UpdateToast').UpdateToast;

beforeAll(async () => {
  const mod = await import('../../../src/components/pwa/UpdateToast');
  UpdateToast = mod.UpdateToast;
});

describe('UpdateToast', () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    mockOfflineReady = false;
    mockCountdown = null;
    mockUpdateServiceWorker.mockClear();
    mockDismissUpdate.mockClear();
  });

  it('renders nothing when no update is needed and not offline ready', () => {
    const { container } = render(<UpdateToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders update toast when needRefresh is true', () => {
    mockNeedRefresh = true;
    mockCountdown = 5;
    render(<UpdateToast />);

    expect(screen.getByText(/new version available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload now/i })).toBeInTheDocument();
  });

  it('calls updateServiceWorker when reload button is clicked', async () => {
    mockNeedRefresh = true;
    mockCountdown = 5;
    render(<UpdateToast />);

    await userEvent.click(screen.getByRole('button', { name: /reload now/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalled();
  });

  it('calls dismissUpdate when dismiss button is clicked', async () => {
    mockNeedRefresh = true;
    mockCountdown = 5;
    render(<UpdateToast />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockDismissUpdate).toHaveBeenCalled();
  });

  it('renders offline ready toast when offlineReady is true', () => {
    mockOfflineReady = true;
    render(<UpdateToast />);

    expect(screen.getByText(/ready to work offline/i)).toBeInTheDocument();
  });

  it('dismiss on offline ready toast calls dismissUpdate', async () => {
    mockOfflineReady = true;
    render(<UpdateToast />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockDismissUpdate).toHaveBeenCalled();
  });

  it('displays countdown seconds when countdown is active', () => {
    mockNeedRefresh = true;
    mockCountdown = 3;
    render(<UpdateToast />);

    expect(screen.getByText(/auto-updating in 3s/i)).toBeInTheDocument();
  });

  it('shows settings preserved message during update', () => {
    mockNeedRefresh = true;
    mockCountdown = 5;
    render(<UpdateToast />);

    expect(screen.getByText(/your settings will be preserved/i)).toBeInTheDocument();
  });
});
