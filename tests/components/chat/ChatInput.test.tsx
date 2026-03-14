import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../../../src/components/chat/ChatInput';

describe('ChatInput', () => {
  it('renders a textarea', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onSend when send button is clicked', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Hello!');

    const sendButton = screen.getByLabelText('Send message');
    await userEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledWith('Hello!');
  });

  it('clears input after submit', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'test');

    const sendButton = screen.getByLabelText('Send message');
    await userEvent.click(sendButton);

    expect(textarea.value).toBe('');
  });

  it('does not submit empty input', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const sendButton = screen.getByLabelText('Send message');
    await userEvent.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables textarea when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('does not submit when disabled even with text', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} />);

    const textarea = screen.getByRole('textbox');
    // The textarea is disabled, so we can't type. Set value directly.
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not submit on Shift+Enter', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'test');

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('submits on Enter key (not Shift+Enter)', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'test');

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalled();
  });

  // --- Stop button tests ---

  it('shows stop button when isGenerating is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} isGenerating={true} onStop={vi.fn()} />);
    expect(screen.getByLabelText('Stop generation')).toBeInTheDocument();
  });

  it('does not show stop button when isGenerating is false', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} isGenerating={false} onStop={vi.fn()} />);
    expect(screen.queryByLabelText('Stop generation')).toBeNull();
  });

  it('shows send button when not generating', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} isGenerating={false} />);
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stop generation')).toBeNull();
  });

  it('calls onStop when stop button is clicked', async () => {
    const onStop = vi.fn();
    render(<ChatInput onSend={vi.fn()} disabled={true} isGenerating={true} onStop={onStop} />);

    const stopButton = screen.getByLabelText('Stop generation');
    await userEvent.click(stopButton);

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('stop button is not disabled even when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} isGenerating={true} onStop={vi.fn()} />);
    const stopButton = screen.getByLabelText('Stop generation');
    expect(stopButton).not.toBeDisabled();
  });
});
