import { render, screen } from '@testing-library/react';
import { MessageList } from '../../../src/components/chat/MessageList';
import type { StoredMessage } from '../../../src/types';

// Mock MessageBubble since it has complex rendering
vi.mock('../../../src/components/chat/MessageBubble', () => ({
  MessageBubble: ({ message }: { message: StoredMessage }) => (
    <div data-testid="message-bubble">{message.content}</div>
  ),
}));

describe('MessageList', () => {
  const messages: StoredMessage[] = [
    {
      id: 'msg-1',
      groupId: 'br:main',
      sender: 'User',
      content: 'Hello',
      timestamp: 1000,
      channel: 'browser',
      isFromMe: false,
      isTrigger: false,
    },
    {
      id: 'msg-2',
      groupId: 'br:main',
      sender: 'Andy',
      content: 'Hi there!',
      timestamp: 2000,
      channel: 'browser',
      isFromMe: true,
      isTrigger: false,
    },
  ];

  it('renders all messages', () => {
    render(<MessageList messages={messages} />);
    const bubbles = screen.getAllByTestId('message-bubble');
    expect(bubbles).toHaveLength(2);
  });

  it('renders empty list', () => {
    const { container } = render(<MessageList messages={[]} />);
    expect(container).toBeTruthy();
    expect(screen.queryByTestId('message-bubble')).toBeNull();
  });

  it('displays message content', () => {
    render(<MessageList messages={messages} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });
});
