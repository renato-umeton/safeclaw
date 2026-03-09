import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPage } from '../../../src/components/chat/ChatPage';

const mockSendMessage = vi.fn();
const mockClearError = vi.fn();
const mockLoadHistory = vi.fn();

// Default state — no messages, idle
const defaultState = {
  messages: [],
  isTyping: false,
  toolActivity: null,
  activityLog: [],
  state: 'idle',
  tokenUsage: null,
  error: null,
  webllmProgress: null,
  sendMessage: mockSendMessage,
  newSession: vi.fn(),
  compactContext: vi.fn(),
  clearError: mockClearError,
  loadHistory: mockLoadHistory,
  ready: true,
};

let currentState: any = { ...defaultState };

vi.mock('../../../src/stores/orchestrator-store', () => {
  const store: any = vi.fn((selector: any) => {
    return selector ? selector(currentState) : currentState;
  });
  store.getState = () => currentState;
  return { useOrchestratorStore: store };
});

vi.mock('../../../src/stores/file-viewer-store', () => ({
  useFileViewerStore: vi.fn((selector: any) => {
    const state = { file: null, openFile: vi.fn(), closeFile: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentState = { ...defaultState };
  });

  it('renders the chat page', () => {
    const { container } = render(<ChatPage />);
    expect(container).toBeTruthy();
  });

  it('shows prompt starters when no messages', () => {
    render(<ChatPage />);
    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
    expect(screen.getByText('Latest news')).toBeInTheDocument();
    expect(screen.getByText('Generate a report')).toBeInTheDocument();
    expect(screen.getByText('Map viewer')).toBeInTheDocument();
  });

  it('sends message when prompt starter is clicked', () => {
    render(<ChatPage />);
    fireEvent.click(screen.getByText('Latest news').closest('button')!);
    expect(mockSendMessage).toHaveBeenCalledWith(
      'Get me the top trending posts from HackerNews.',
    );
  });

  it('renders input area', () => {
    render(<ChatPage />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('hides prompt starters when messages exist', () => {
    currentState = {
      ...defaultState,
      messages: [
        { id: '1', groupId: 'br:main', sender: 'User', content: 'Hi', timestamp: Date.now(), channel: 'browser', isFromMe: false, isTrigger: true },
      ],
    };
    render(<ChatPage />);
    expect(screen.queryByText('Start a conversation')).toBeNull();
  });

  it('shows typing indicator when isTyping is true', () => {
    currentState = { ...defaultState, isTyping: true };
    const { container } = render(<ChatPage />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('shows tool activity when present', () => {
    currentState = { ...defaultState, toolActivity: { tool: 'bash', status: 'running' } };
    render(<ChatPage />);
    expect(screen.getByText(/bash/)).toBeInTheDocument();
  });

  it('shows error alert when error is set', () => {
    currentState = { ...defaultState, error: 'Something went wrong' };
    render(<ChatPage />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clears error when dismiss button is clicked', () => {
    currentState = { ...defaultState, error: 'Some error' };
    render(<ChatPage />);
    const alert = screen.getByRole('alert');
    const dismissBtn = alert.querySelector('button')!;
    fireEvent.click(dismissBtn);
    expect(mockClearError).toHaveBeenCalled();
  });

  it('shows token usage bar when tokenUsage is set', () => {
    currentState = {
      ...defaultState,
      tokenUsage: {
        groupId: 'br:main',
        inputTokens: 50_000,
        outputTokens: 5_000,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        contextLimit: 200_000,
      },
    };
    const { container } = render(<ChatPage />);
    expect(container.querySelector('progress')).toBeTruthy();
  });

  it('shows activity log when entries exist', () => {
    currentState = {
      ...defaultState,
      activityLog: [
        { kind: 'info' as const, label: 'Thinking', detail: 'Processing...' },
      ],
    };
    render(<ChatPage />);
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('disables input when not idle', () => {
    currentState = { ...defaultState, state: 'thinking' };
    render(<ChatPage />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('calls loadHistory on mount', () => {
    render(<ChatPage />);
    expect(mockLoadHistory).toHaveBeenCalled();
  });

  it('shows model download progress when webllmProgress is set', () => {
    currentState = {
      ...defaultState,
      webllmProgress: { model: 'qwen3-4b', progress: 45, status: 'Downloading model...' },
    };
    render(<ChatPage />);
    expect(screen.getByText(/Downloading model/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not show model download progress when webllmProgress is null', () => {
    currentState = { ...defaultState, webllmProgress: null };
    render(<ChatPage />);
    expect(screen.queryByText(/Downloading model/)).toBeNull();
  });
});
