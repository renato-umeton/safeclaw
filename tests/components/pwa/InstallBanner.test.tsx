// ---------------------------------------------------------------------------
// InstallBanner component tests
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the usePwaInstall hook
const mockPromptInstall = vi.fn();
const mockDismiss = vi.fn();
let mockCanInstall = false;
let mockShowBanner = false;
let mockPlatform: 'chromium' | 'ios' | 'unsupported' | null = null;

vi.mock('../../../src/hooks/use-pwa-install.js', () => ({
  usePwaInstall: () => ({
    canInstall: mockCanInstall,
    showBanner: mockShowBanner,
    platform: mockPlatform,
    promptInstall: mockPromptInstall,
    dismiss: mockDismiss,
  }),
}));

let InstallBanner: typeof import('../../../src/components/pwa/InstallBanner').InstallBanner;

beforeAll(async () => {
  const mod = await import('../../../src/components/pwa/InstallBanner');
  InstallBanner = mod.InstallBanner;
});

describe('InstallBanner', () => {
  beforeEach(() => {
    mockCanInstall = false;
    mockShowBanner = false;
    mockPlatform = null;
    mockPromptInstall.mockClear();
    mockDismiss.mockClear();
  });

  it('renders nothing when showBanner is false', () => {
    const { container } = render(<InstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders install banner for Chromium with install button when canInstall', () => {
    mockCanInstall = true;
    mockShowBanner = true;
    mockPlatform = 'chromium';
    render(<InstallBanner />);

    expect(screen.getByText(/install safeclaw/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^install$/i })).toBeInTheDocument();
  });

  it('renders Chromium banner without install button when canInstall is false', () => {
    mockCanInstall = false;
    mockShowBanner = true;
    mockPlatform = 'chromium';
    render(<InstallBanner />);

    expect(screen.getByText(/install safeclaw/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^install$/i })).not.toBeInTheDocument();
  });

  it('calls promptInstall when install button is clicked on Chromium', async () => {
    mockCanInstall = true;
    mockShowBanner = true;
    mockPlatform = 'chromium';
    mockPromptInstall.mockResolvedValue('accepted');
    render(<InstallBanner />);

    await userEvent.click(screen.getByRole('button', { name: /^install$/i }));
    expect(mockPromptInstall).toHaveBeenCalled();
  });

  it('renders iOS instructions when platform is ios', () => {
    mockCanInstall = true;
    mockShowBanner = true;
    mockPlatform = 'ios';
    render(<InstallBanner />);

    expect(screen.getByText(/install safeclaw/i)).toBeInTheDocument();
    // Should show iOS-specific guidance mentioning Share button
    expect(screen.getByText(/share/i)).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it('renders unsupported browser message for non-Chrome browsers', () => {
    mockCanInstall = false;
    mockShowBanner = true;
    mockPlatform = 'unsupported';
    render(<InstallBanner />);

    expect(screen.getByText(/chrome required/i)).toBeInTheDocument();
    // Should not show install button for unsupported browsers
    expect(screen.queryByRole('button', { name: /^install$/i })).not.toBeInTheDocument();
  });

  it('calls dismiss when close button is clicked', async () => {
    mockCanInstall = true;
    mockShowBanner = true;
    mockPlatform = 'chromium';
    render(<InstallBanner />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('shows dismiss button for unsupported browser banner', async () => {
    mockCanInstall = false;
    mockShowBanner = true;
    mockPlatform = 'unsupported';
    render(<InstallBanner />);

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockDismiss).toHaveBeenCalled();
  });
});
