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

vi.mock('../../../src/hooks/use-pwa-update.js', () => ({
  usePwaUpdate: () => ({
    needRefresh: mockNeedRefresh,
    offlineReady: mockOfflineReady,
    updateServiceWorker: mockUpdateServiceWorker,
    dismissUpdate: mockDismissUpdate,
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
    mockUpdateServiceWorker.mockClear();
    mockDismissUpdate.mockClear();
  });

  it('renders nothing when no update is needed and not offline ready', () => {
    const { container } = render(<UpdateToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders update toast when needRefresh is true', () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);

    expect(screen.getByText(/new version available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('calls updateServiceWorker when reload button is clicked', async () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);

    await userEvent.click(screen.getByRole('button', { name: /reload/i }));
    expect(mockUpdateServiceWorker).toHaveBeenCalled();
  });

  it('calls dismissUpdate when dismiss button is clicked', async () => {
    mockNeedRefresh = true;
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
});
