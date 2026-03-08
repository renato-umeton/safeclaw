import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChatActions } from '../../../src/components/chat/ChatActions';

const mockCompactContext = vi.fn().mockResolvedValue(undefined);
const mockNewSession = vi.fn().mockResolvedValue(undefined);

// Mock the orchestrator store
vi.mock('../../../src/stores/orchestrator-store', () => ({
  useOrchestratorStore: vi.fn((selector) => {
    const state = {
      compactContext: mockCompactContext,
      newSession: mockNewSession,
    };
    return selector ? selector(state) : state;
  }),
}));

describe('ChatActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Basic rendering ----

  it('renders compact and new session buttons', () => {
    render(<ChatActions disabled={false} />);
    expect(screen.getByText('Compact')).toBeInTheDocument();
    expect(screen.getByText('New Session')).toBeInTheDocument();
  });

  it('renders exactly two action buttons when no dialog is open', () => {
    render(<ChatActions disabled={false} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  // ---- Disabled state ----

  it('disables buttons when disabled prop is true', () => {
    render(<ChatActions disabled={true} />);
    const compactBtn = screen.getByText('Compact').closest('button')!;
    const newSessionBtn = screen.getByText('New Session').closest('button')!;
    expect(compactBtn).toBeDisabled();
    expect(newSessionBtn).toBeDisabled();
  });

  it('enables buttons when disabled prop is false', () => {
    render(<ChatActions disabled={false} />);
    const compactBtn = screen.getByText('Compact').closest('button')!;
    const newSessionBtn = screen.getByText('New Session').closest('button')!;
    expect(compactBtn).not.toBeDisabled();
    expect(newSessionBtn).not.toBeDisabled();
  });

  // ---- Compact confirmation dialog ----

  it('shows compact confirmation dialog when compact is clicked', () => {
    render(<ChatActions disabled={false} />);
    const compactBtn = screen.getByText('Compact').closest('button')!;
    fireEvent.click(compactBtn);

    expect(screen.getByText('Compact Context')).toBeInTheDocument();
    expect(screen.getByText(/summarize the conversation/)).toBeInTheDocument();
  });

  it('shows correct dialog buttons for compact action', () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('Compact').closest('button')!);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // The confirm button for compact is inside the modal with btn-primary class
    const dialog = document.querySelector('dialog')!;
    const confirmBtn = dialog.querySelector('.btn-primary');
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn!.textContent).toBe('Compact');
  });

  it('calls compactContext when compact is confirmed', async () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('Compact').closest('button')!);

    const dialog = document.querySelector('dialog')!;
    const confirmBtn = dialog.querySelector('.btn-primary')!;

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockCompactContext).toHaveBeenCalledTimes(1);
  });

  it('closes compact dialog after confirmation', async () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('Compact').closest('button')!);
    expect(screen.getByText('Compact Context')).toBeInTheDocument();

    const dialog = document.querySelector('dialog')!;
    const confirmBtn = dialog.querySelector('.btn-primary')!;

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(screen.queryByText('Compact Context')).toBeNull();
  });

  it('closes compact dialog when Cancel is clicked', () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('Compact').closest('button')!);
    expect(screen.getByText('Compact Context')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Compact Context')).toBeNull();
  });

  // ---- New Session confirmation dialog ----

  it('shows new session confirmation dialog when new session is clicked', () => {
    render(<ChatActions disabled={false} />);
    // There are two elements with "New Session" text - button + dialog title
    const newSessionBtn = screen.getAllByText('New Session')[0].closest('button')!;
    fireEvent.click(newSessionBtn);

    // Dialog title should appear (there will now be 2 "New Session" texts)
    const dialog = document.querySelector('dialog')!;
    expect(dialog).toBeTruthy();
    expect(screen.getByText(/clear all messages/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('shows btn-error style for new session confirm button', () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('New Session').closest('button')!);

    const confirmBtn = screen.getByText('Clear & Start New');
    expect(confirmBtn.classList.contains('btn-error')).toBe(true);
  });

  it('calls newSession when new session is confirmed', async () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('New Session').closest('button')!);

    await act(async () => {
      fireEvent.click(screen.getByText('Clear & Start New'));
    });

    expect(mockNewSession).toHaveBeenCalledTimes(1);
  });

  it('closes new session dialog after confirmation', async () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('New Session').closest('button')!);

    await act(async () => {
      fireEvent.click(screen.getByText('Clear & Start New'));
    });

    expect(screen.queryByText('Clear & Start New')).toBeNull();
  });

  it('closes new session dialog when Cancel is clicked', () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('New Session').closest('button')!);
    expect(screen.getByText('Clear & Start New')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Clear & Start New')).toBeNull();
  });

  // ---- Backdrop close ----

  it('closes dialog when modal backdrop is clicked for compact', () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('Compact').closest('button')!);
    expect(screen.getByText('Compact Context')).toBeInTheDocument();

    // The backdrop has a close button
    const backdropClose = screen.getByText('close');
    fireEvent.click(backdropClose);
    expect(screen.queryByText('Compact Context')).toBeNull();
  });

  it('closes dialog when modal backdrop is clicked for new session', () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('New Session').closest('button')!);

    const backdropClose = screen.getByText('close');
    fireEvent.click(backdropClose);
    expect(screen.queryByText('Clear & Start New')).toBeNull();
  });

  // ---- Does not call wrong action ----

  it('does not call newSession when compact is confirmed', async () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('Compact').closest('button')!);

    const dialog = document.querySelector('dialog')!;
    const confirmBtn = dialog.querySelector('.btn-primary')!;

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockCompactContext).toHaveBeenCalledTimes(1);
    expect(mockNewSession).not.toHaveBeenCalled();
  });

  it('does not call compactContext when new session is confirmed', async () => {
    render(<ChatActions disabled={false} />);
    fireEvent.click(screen.getByText('New Session').closest('button')!);

    await act(async () => {
      fireEvent.click(screen.getByText('Clear & Start New'));
    });

    expect(mockNewSession).toHaveBeenCalledTimes(1);
    expect(mockCompactContext).not.toHaveBeenCalled();
  });
});
