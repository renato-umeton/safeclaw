import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SettingsPage } from '../../../src/components/settings/SettingsPage';

// Mock orchestrator store
const mockSetApiKey = vi.fn().mockResolvedValue(undefined);
const mockSetProviderId = vi.fn().mockResolvedValue(undefined);
const mockSetModel = vi.fn().mockResolvedValue(undefined);
const mockSetLocalPreference = vi.fn().mockResolvedValue(undefined);
const mockSetAssistantName = vi.fn().mockResolvedValue(undefined);
const mockConfigureTelegram = vi.fn().mockResolvedValue(undefined);
const mockPreloadModel = vi.fn().mockResolvedValue(undefined);

let mockProviderId = 'anthropic';
let mockModel = 'claude-sonnet-4-6';
let mockWebllmProgress: any = null;

vi.mock('../../../src/stores/orchestrator-store', () => ({
  useOrchestratorStore: vi.fn((selector) => {
    const state = {
      ready: true,
      state: 'idle',
      webllmProgress: mockWebllmProgress,
    };
    return selector ? selector(state) : state;
  }),
  getOrchestrator: vi.fn(() => ({
    getProviderId: () => mockProviderId,
    getApiKey: (p: string) => '',
    getModel: () => mockModel,
    getLocalPreference: () => 'offline-only',
    getAssistantName: () => 'Andy',
    setApiKey: mockSetApiKey,
    setProviderId: (...args: any[]) => {
      mockProviderId = args[0];
      return mockSetProviderId(...args);
    },
    setModel: (...args: any[]) => {
      mockModel = args[0];
      return mockSetModel(...args);
    },
    setLocalPreference: mockSetLocalPreference,
    setAssistantName: mockSetAssistantName,
    configureTelegram: mockConfigureTelegram,
    preloadModel: mockPreloadModel,
    telegram: { isConfigured: () => false },
  })),
}));

const mockSetTheme = vi.fn();
vi.mock('../../../src/stores/theme-store', () => ({
  useThemeStore: vi.fn(() => ({
    theme: 'system' as const,
    resolved: 'light' as const,
    setTheme: mockSetTheme,
  })),
}));

const mockRequestPersistentStorage = vi.fn().mockResolvedValue(true);
const mockGetModelCacheEstimate = vi.fn().mockResolvedValue(0);
const mockDeleteModelCaches = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/storage', () => ({
  getStorageEstimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 1073741824 }),
  requestPersistentStorage: (...args: any[]) => mockRequestPersistentStorage(...args),
  getModelCacheEstimate: (...args: any[]) => mockGetModelCacheEstimate(...args),
  deleteModelCaches: (...args: any[]) => mockDeleteModelCaches(...args),
}));

// Mock DB to prevent IndexedDB calls during render
vi.mock('../../../src/db', () => ({
  getConfig: vi.fn().mockResolvedValue(null),
  openDatabase: vi.fn().mockResolvedValue(undefined),
  getRecentMessages: vi.fn().mockResolvedValue([]),
  getUserProfile: vi.fn().mockResolvedValue(null),
  saveUserProfile: vi.fn().mockResolvedValue(undefined),
  clearUserProfile: vi.fn().mockResolvedValue(undefined),
}));

// Mock crypto
vi.mock('../../../src/crypto', () => ({
  decryptValue: vi.fn().mockResolvedValue(''),
}));

// Mock VersionSection to avoid fetch calls in SettingsPage tests
vi.mock('../../../src/components/settings/VersionSection', () => ({
  VersionSection: () => <div data-testid="version-section">Version</div>,
}));

vi.mock('../../../src/components/settings/AcknowledgementsSection', () => ({
  AcknowledgementsSection: () => <div data-testid="acknowledgements-section">Acknowledgements</div>,
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockProviderId = 'anthropic';
    mockModel = 'claude-sonnet-4-6';
    mockWebllmProgress = null;
    mockGetModelCacheEstimate.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- Basic rendering ----

  it('renders the settings page with heading', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders all settings sections', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('LLM Provider')).toBeInTheDocument();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('Local Models')).toBeInTheDocument();
    expect(screen.getByText('Assistant Name')).toBeInTheDocument();
    expect(screen.getByText('Your Profile')).toBeInTheDocument();
    expect(screen.getByText('Telegram Bot')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('Acknowledgements')).toBeInTheDocument();
  });

  // ---- Semantic grouping ----

  it('renders semantic group headings', () => {
    render(<SettingsPage />);
    expect(screen.getByText('AI & Models')).toBeInTheDocument();
    expect(screen.getByText('Personalization')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Storage & System')).toBeInTheDocument();
  });

  // ---- Theme selection ----

  it('renders theme selector with current value', () => {
    render(<SettingsPage />);
    const themeSelect = screen.getByDisplayValue('System');
    expect(themeSelect).toBeInTheDocument();
  });

  it('calls setTheme when theme is changed', () => {
    render(<SettingsPage />);
    const themeSelect = screen.getByDisplayValue('System');
    fireEvent.change(themeSelect, { target: { value: 'dark' } });
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  // ---- Provider selection ----

  it('shows current provider in selector', () => {
    render(<SettingsPage />);
    const providerSelect = screen.getByDisplayValue('Anthropic Claude');
    expect(providerSelect).toBeInTheDocument();
  });

  it('lists all providers in the selector', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Anthropic Claude')).toBeInTheDocument();
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('WebLLM (Local) (Local)')).toBeInTheDocument();
    expect(screen.getByText('Chrome AI (Gemini Nano) (Local)')).toBeInTheDocument();
  });

  it('changes provider and sets default model', async () => {
    render(<SettingsPage />);
    const providerSelect = screen.getByDisplayValue('Anthropic Claude');

    await act(async () => {
      fireEvent.change(providerSelect, { target: { value: 'gemini' } });
    });

    expect(mockSetProviderId).toHaveBeenCalledWith('gemini');
    expect(mockSetModel).toHaveBeenCalledWith('gemini-2.5-pro-preview-06-05');
  });

  // ---- Model selection ----

  it('shows current model in selector', () => {
    render(<SettingsPage />);
    const modelSelect = screen.getByDisplayValue('Claude Sonnet 4.6');
    expect(modelSelect).toBeInTheDocument();
  });

  it('changes model when selected', async () => {
    render(<SettingsPage />);
    const modelSelect = screen.getByDisplayValue('Claude Sonnet 4.6');

    await act(async () => {
      fireEvent.change(modelSelect, { target: { value: 'claude-opus-4-6' } });
    });

    expect(mockSetModel).toHaveBeenCalledWith('claude-opus-4-6');
  });

  // ---- API key handling ----

  it('renders Anthropic API key input as password by default', () => {
    render(<SettingsPage />);
    const inputs = screen.getAllByPlaceholderText('sk-ant-...');
    expect(inputs[0]).toHaveAttribute('type', 'password');
  });

  it('toggles Anthropic API key visibility', () => {
    render(<SettingsPage />);
    const inputs = screen.getAllByPlaceholderText('sk-ant-...');
    const input = inputs[0];
    expect(input).toHaveAttribute('type', 'password');

    // Find the toggle button near the input (Eye icon)
    const eyeButtons = screen.getAllByRole('button').filter(b =>
      b.classList.contains('btn-ghost') && b.classList.contains('btn-sm')
    );
    // The first eye button is for Anthropic key
    fireEvent.click(eyeButtons[0]);
    expect(input).toHaveAttribute('type', 'text');
  });

  it('disables Anthropic save button when key is empty', () => {
    render(<SettingsPage />);
    // Find the first Save button (Anthropic)
    const saveButtons = screen.getAllByText('Save');
    expect(saveButtons[0]).toBeDisabled();
  });

  it('enables Anthropic save button when key has content', () => {
    render(<SettingsPage />);
    const input = screen.getAllByPlaceholderText('sk-ant-...')[0];
    fireEvent.change(input, { target: { value: 'sk-ant-test123' } });

    const saveButtons = screen.getAllByText('Save');
    expect(saveButtons[0]).not.toBeDisabled();
  });

  it('saves Anthropic API key when save is clicked', async () => {
    render(<SettingsPage />);
    const input = screen.getAllByPlaceholderText('sk-ant-...')[0];
    fireEvent.change(input, { target: { value: 'sk-ant-test123' } });

    const saveButtons = screen.getAllByText('Save');
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    expect(mockSetApiKey).toHaveBeenCalledWith('anthropic', 'sk-ant-test123');
  });

  it('shows saved confirmation after saving Anthropic key', async () => {
    render(<SettingsPage />);
    const input = screen.getAllByPlaceholderText('sk-ant-...')[0];
    fireEvent.change(input, { target: { value: 'sk-ant-test123' } });

    const saveButtons = screen.getAllByText('Save');
    await act(async () => {
      fireEvent.click(saveButtons[0]);
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();

    // Confirmation disappears after 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('renders Gemini API key input', () => {
    render(<SettingsPage />);
    const inputs = screen.getAllByPlaceholderText('AIza...');
    expect(inputs[0]).toHaveAttribute('type', 'password');
  });

  it('saves Gemini API key when save is clicked', async () => {
    render(<SettingsPage />);
    const input = screen.getAllByPlaceholderText('AIza...')[0];
    fireEvent.change(input, { target: { value: 'AIza-test-key' } });

    const saveButtons = screen.getAllByText('Save');
    await act(async () => {
      fireEvent.click(saveButtons[1]); // Second save button is for Gemini
    });

    expect(mockSetApiKey).toHaveBeenCalledWith('gemini', 'AIza-test-key');
  });

  // ---- Local model preference ----

  it('shows local preference selector with current value', () => {
    render(<SettingsPage />);
    const select = screen.getByDisplayValue(/Offline fallback/);
    expect(select).toBeInTheDocument();
  });

  it('changes local preference', async () => {
    render(<SettingsPage />);
    const select = screen.getByDisplayValue(/Offline fallback/);
    await act(async () => {
      fireEvent.change(select, { target: { value: 'always' } });
    });
    expect(mockSetLocalPreference).toHaveBeenCalledWith('always');
  });

  // ---- Assistant name ----

  it('shows assistant name input with current value', () => {
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText('Andy');
    expect(input).toHaveValue('Andy');
  });

  it('saves assistant name on blur', async () => {
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText('Andy');
    fireEvent.change(input, { target: { value: 'NewBot' } });

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(mockSetAssistantName).toHaveBeenCalledWith('NewBot');
  });

  // ---- Telegram configuration ----

  it('shows telegram bot token input', () => {
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText('123456:ABC-DEF...');
    expect(input).toBeInTheDocument();
  });

  it('shows telegram chat IDs input', () => {
    render(<SettingsPage />);
    const input = screen.getByPlaceholderText('-100123456, 789012');
    expect(input).toBeInTheDocument();
  });

  it('disables Save Telegram Config when token is empty', () => {
    render(<SettingsPage />);
    const btn = screen.getByText('Save Telegram Config');
    expect(btn).toBeDisabled();
  });

  it('saves telegram config when save is clicked', async () => {
    render(<SettingsPage />);
    const tokenInput = screen.getByPlaceholderText('123456:ABC-DEF...');
    const chatIdsInput = screen.getByPlaceholderText('-100123456, 789012');

    fireEvent.change(tokenInput, { target: { value: '123:ABC' } });
    fireEvent.change(chatIdsInput, { target: { value: '-100, 200' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Telegram Config'));
    });

    expect(mockConfigureTelegram).toHaveBeenCalledWith('123:ABC', ['-100', '200']);
  });

  // ---- Storage ----

  it('displays storage usage info', async () => {
    await act(async () => {
      render(<SettingsPage />);
    });
    // After async load, storage info should be visible
    // formatBytes(1024) = "1.0 KB" so the text is "1.0 KB used"
    await waitFor(() => {
      expect(screen.getByText(/KB used/)).toBeInTheDocument();
    });
  });

  it('shows persistent storage request button when not persistent', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Request Persistent Storage')).toBeInTheDocument();
  });

  it('requests persistent storage when button is clicked', async () => {
    render(<SettingsPage />);

    await act(async () => {
      fireEvent.click(screen.getByText('Request Persistent Storage'));
    });

    expect(mockRequestPersistentStorage).toHaveBeenCalled();
  });

  // ---- Storage breakdown ----

  it('shows storage breakdown with model weights and other data', async () => {
    mockGetModelCacheEstimate.mockResolvedValue(524288); // 512 KB

    const { getStorageEstimate } = await import('../../../src/storage');
    (getStorageEstimate as any).mockResolvedValue({ usage: 1048576, quota: 1073741824 }); // 1 MB

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Model weights')).toBeInTheDocument();
      expect(screen.getByText('Other data')).toBeInTheDocument();
      // Both model weights and other data show 512.0 KB
      const kbTexts = screen.getAllByText('512.0 KB');
      expect(kbTexts.length).toBe(2);
    });
  });

  it('shows Delete Model Weights button when cache has data', async () => {
    mockGetModelCacheEstimate.mockResolvedValue(1048576); // 1 MB

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Delete Model Weights')).toBeInTheDocument();
    });
  });

  it('does not show Delete Model Weights button when cache is empty', async () => {
    mockGetModelCacheEstimate.mockResolvedValue(0);

    await act(async () => {
      render(<SettingsPage />);
    });

    expect(screen.queryByText('Delete Model Weights')).toBeNull();
  });

  it('calls deleteModelCaches and refreshes storage when delete is clicked', async () => {
    mockGetModelCacheEstimate.mockResolvedValue(1048576);

    const { getStorageEstimate } = await import('../../../src/storage');
    (getStorageEstimate as any).mockResolvedValue({ usage: 2097152, quota: 1073741824 });

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Delete Model Weights')).toBeInTheDocument();
    });

    // After delete, getStorageEstimate returns reduced usage
    (getStorageEstimate as any).mockResolvedValue({ usage: 1048576, quota: 1073741824 });

    await act(async () => {
      fireEvent.click(screen.getByText('Delete Model Weights'));
    });

    expect(mockDeleteModelCaches).toHaveBeenCalled();
  });

  it('shows re-download notice when model cache exists', async () => {
    mockGetModelCacheEstimate.mockResolvedValue(1048576);

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Models will be re-downloaded/)).toBeInTheDocument();
    });
  });

  // ---- Persistent storage already granted ----

  it('shows persistent storage active badge when already persistent', async () => {
    // Mock navigator.storage.persisted to return true
    const originalStorage = navigator.storage;
    Object.defineProperty(navigator, 'storage', {
      value: {
        ...originalStorage,
        persisted: vi.fn().mockResolvedValue(true),
      },
      configurable: true,
    });

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Persistent storage active')).toBeInTheDocument();
    });

    // The request button should NOT be shown
    expect(screen.queryByText('Request Persistent Storage')).toBeNull();

    Object.defineProperty(navigator, 'storage', { value: originalStorage, configurable: true });
  });

  // ---- Gemini key visibility toggle ----

  it('toggles Gemini API key visibility', () => {
    render(<SettingsPage />);
    const input = screen.getAllByPlaceholderText('AIza...')[0];
    expect(input).toHaveAttribute('type', 'password');

    // Find the ghost buttons - second one is for Gemini
    const eyeButtons = screen.getAllByRole('button').filter(b =>
      b.classList.contains('btn-ghost') && b.classList.contains('btn-sm')
    );
    fireEvent.click(eyeButtons[1]);
    expect(input).toHaveAttribute('type', 'text');
  });

  // ---- Gemini saved confirmation ----

  it('shows saved confirmation after saving Gemini key', async () => {
    render(<SettingsPage />);
    const input = screen.getAllByPlaceholderText('AIza...')[0];
    fireEvent.change(input, { target: { value: 'AIza-test-key' } });

    const saveButtons = screen.getAllByText('Save');
    await act(async () => {
      fireEvent.click(saveButtons[1]);
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  // ---- Telegram saved confirmation ----

  it('shows saved confirmation after saving Telegram config', async () => {
    render(<SettingsPage />);
    const tokenInput = screen.getByPlaceholderText('123456:ABC-DEF...');
    fireEvent.change(tokenInput, { target: { value: '123:ABC' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Telegram Config'));
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  // ---- Pre-loaded config values ----

  it('loads existing Anthropic key from config on mount', async () => {
    const { getConfig } = await import('../../../src/db');
    const { decryptValue } = await import('../../../src/crypto');
    (getConfig as any).mockImplementation(async (key: string) => {
      if (key === 'anthropic_api_key') return 'encrypted-anthropic-key';
      return null;
    });
    (decryptValue as any).mockResolvedValue('sk-ant-decrypted');

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      const input = screen.getAllByPlaceholderText('sk-ant-...')[0];
      expect(input).toHaveValue('sk-ant-decrypted');
    });
  });

  it('loads existing Gemini key from config on mount', async () => {
    const { getConfig } = await import('../../../src/db');
    const { decryptValue } = await import('../../../src/crypto');
    (getConfig as any).mockImplementation(async (key: string) => {
      if (key === 'gemini_api_key') return 'encrypted-gemini-key';
      return null;
    });
    (decryptValue as any).mockResolvedValue('AIza-decrypted');

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      const input = screen.getAllByPlaceholderText('AIza...')[0];
      expect(input).toHaveValue('AIza-decrypted');
    });
  });

  it('loads existing Telegram config on mount', async () => {
    const { getConfig } = await import('../../../src/db');
    (getConfig as any).mockImplementation(async (key: string) => {
      if (key === 'telegram_bot_token') return 'bot-token-123';
      if (key === 'telegram_chat_ids') return JSON.stringify(['-100', '200']);
      return null;
    });

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText('123456:ABC-DEF...');
      expect(tokenInput).toHaveValue('bot-token-123');
    });
    const chatInput = screen.getByPlaceholderText('-100123456, 789012');
    expect(chatInput).toHaveValue('-100, 200');
  });

  it('handles non-JSON telegram chat IDs gracefully', async () => {
    const { getConfig } = await import('../../../src/db');
    (getConfig as any).mockImplementation(async (key: string) => {
      if (key === 'telegram_chat_ids') return 'not-valid-json';
      return null;
    });

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      const chatInput = screen.getByPlaceholderText('-100123456, 789012');
      expect(chatInput).toHaveValue('not-valid-json');
    });
  });

  it('handles decryption failure gracefully', async () => {
    const { getConfig } = await import('../../../src/db');
    const { decryptValue } = await import('../../../src/crypto');
    (getConfig as any).mockImplementation(async (key: string) => {
      if (key === 'anthropic_api_key') return 'encrypted-key';
      return null;
    });
    (decryptValue as any).mockRejectedValue(new Error('decrypt failed'));

    await act(async () => {
      render(<SettingsPage />);
    });

    // Should render without crashing, key stays empty
    const input = screen.getAllByPlaceholderText('sk-ant-...')[0];
    expect(input).toHaveValue('');
  });

  // ---- Hardware info branches ----

  it('shows WebGPU available badge when gpu is in navigator', async () => {
    (navigator as any).gpu = {};
    await act(async () => {
      render(<SettingsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText('WebGPU available')).toBeInTheDocument();
    });
    delete (navigator as any).gpu;
  });

  it('shows device memory badge when deviceMemory is set', async () => {
    (navigator as any).deviceMemory = 8;
    await act(async () => {
      render(<SettingsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText('8 GB device memory')).toBeInTheDocument();
    });
    delete (navigator as any).deviceMemory;
  });

  it('shows low memory warning when deviceMemory < 4', async () => {
    (navigator as any).deviceMemory = 2;
    await act(async () => {
      render(<SettingsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText(/Less than 4 GB device memory/)).toBeInTheDocument();
    });
    delete (navigator as any).deviceMemory;
  });

  it('shows Chrome AI ready when window.ai reports readily', async () => {
    (window as any).ai = {
      languageModel: {
        capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
      },
    };
    await act(async () => {
      render(<SettingsPage />);
    });
    await waitFor(() => {
      expect(screen.getByText('Chrome AI ready')).toBeInTheDocument();
    });
    delete (window as any).ai;
  });

  // ---- Storage zero quota branch ----

  it('handles zero storage quota without division error', async () => {
    const { getStorageEstimate } = await import('../../../src/storage');
    (getStorageEstimate as any).mockResolvedValue({ usage: 0, quota: 0 });

    await act(async () => {
      render(<SettingsPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('0 B used')).toBeInTheDocument();
    });
  });

  // ---- Offline status ----

  it('shows offline status when navigator.onLine is false', () => {
    const original = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<SettingsPage />);
    expect(screen.getByText(/Offline — local models will be used/)).toBeInTheDocument();
    Object.defineProperty(navigator, 'onLine', { value: original, configurable: true });
  });

  // ---- Persistent storage request denied ----

  it('does not show active badge when persistent storage request is denied', async () => {
    mockRequestPersistentStorage.mockResolvedValueOnce(false);
    render(<SettingsPage />);

    await act(async () => {
      fireEvent.click(screen.getByText('Request Persistent Storage'));
    });

    expect(screen.queryByText('Persistent storage active')).toBeNull();
  });

  // ---- Model pre-download ----

  it('shows Download Model button when webllm provider is selected', async () => {
    mockProviderId = 'webllm';
    mockModel = 'qwen3-4b';
    await act(async () => {
      render(<SettingsPage />);
    });
    expect(screen.getByText('Download Model')).toBeInTheDocument();
  });

  it('does not show Download Model button for cloud providers', () => {
    mockProviderId = 'anthropic';
    render(<SettingsPage />);
    expect(screen.queryByText('Download Model')).toBeNull();
  });

  it('calls preloadModel when Download Model button is clicked', async () => {
    mockProviderId = 'webllm';
    mockModel = 'qwen3-4b';
    await act(async () => {
      render(<SettingsPage />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Download Model'));
    });

    expect(mockPreloadModel).toHaveBeenCalled();
  });

  it('shows download progress bar in settings when webllmProgress is set', async () => {
    mockProviderId = 'webllm';
    mockModel = 'qwen3-4b';
    mockWebllmProgress = { model: 'qwen3-4b', progress: 60, status: 'Downloading...' };
    await act(async () => {
      render(<SettingsPage />);
    });
    expect(screen.getByText(/Downloading/)).toBeInTheDocument();
    // Multiple progressbars exist (storage + model download)
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThanOrEqual(2);
  });
});
