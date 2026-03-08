import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBubble } from '../../../src/components/chat/MessageBubble';
import type { StoredMessage } from '../../../src/types';

// Mock orchestrator store
vi.mock('../../../src/stores/orchestrator-store', () => ({
  getOrchestrator: vi.fn(() => ({
    getAssistantName: () => 'Andy',
  })),
}));

// Mock file viewer store
const mockOpenFile = vi.fn();
vi.mock('../../../src/stores/file-viewer-store', () => ({
  useFileViewerStore: vi.fn((selector: any) => {
    const state = { openFile: mockOpenFile, file: null, closeFile: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

// Mock CodeBlock since we just need to verify it receives props
vi.mock('../../../src/components/chat/CodeBlock', () => ({
  CodeBlock: ({ language, code }: { language: string; code: string }) => (
    <pre data-testid="code-block" data-language={language}>{code}</pre>
  ),
}));

describe('MessageBubble', () => {
  const baseMessage: StoredMessage = {
    id: 'msg-1',
    groupId: 'br:main',
    sender: 'User',
    content: 'Hello!',
    timestamp: 1700000000000,
    channel: 'browser',
    isFromMe: false,
    isTrigger: false,
  };

  const userMessage: StoredMessage = { ...baseMessage };

  const assistantMessage: StoredMessage = {
    ...baseMessage,
    id: 'msg-2',
    sender: 'Andy',
    content: 'Hi there, how can I help?',
    isFromMe: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- User messages ----

  it('renders user message with "You" as sender', () => {
    const { container } = render(<MessageBubble message={userMessage} />);
    expect(container.textContent).toContain('You');
    expect(container.textContent).toContain('Hello!');
  });

  it('applies chat-end class for user messages', () => {
    const { container } = render(<MessageBubble message={userMessage} />);
    expect(container.querySelector('.chat-end')).toBeTruthy();
  });

  it('applies chat-bubble-primary class for user messages', () => {
    const { container } = render(<MessageBubble message={userMessage} />);
    expect(container.querySelector('.chat-bubble-primary')).toBeTruthy();
  });

  it('renders user message as plain text in whitespace-pre-wrap span', () => {
    const { container } = render(<MessageBubble message={userMessage} />);
    const span = container.querySelector('.whitespace-pre-wrap');
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe('Hello!');
  });

  // ---- Assistant messages ----

  it('renders assistant message with sender name from orchestrator', () => {
    const { container } = render(<MessageBubble message={assistantMessage} />);
    expect(container.textContent).toContain('Andy');
  });

  it('applies chat-start class for assistant messages', () => {
    const { container } = render(<MessageBubble message={assistantMessage} />);
    expect(container.querySelector('.chat-start')).toBeTruthy();
  });

  it('does not apply chat-bubble-primary for assistant messages', () => {
    const { container } = render(<MessageBubble message={assistantMessage} />);
    expect(container.querySelector('.chat-bubble-primary')).toBeNull();
  });

  it('renders assistant message as markdown', () => {
    const { container } = render(<MessageBubble message={assistantMessage} />);
    expect(container.querySelector('.chat-markdown')).toBeTruthy();
  });

  it('falls back to msg.sender when getOrchestrator throws', async () => {
    const { getOrchestrator } = await import('../../../src/stores/orchestrator-store');
    (getOrchestrator as any).mockImplementationOnce(() => {
      throw new Error('not initialized');
    });

    const msg: StoredMessage = { ...assistantMessage, sender: 'CustomBot' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.textContent).toContain('CustomBot');
  });

  it('falls back to "Assistant" when getOrchestrator throws and sender is empty', async () => {
    const { getOrchestrator } = await import('../../../src/stores/orchestrator-store');
    (getOrchestrator as any).mockImplementationOnce(() => {
      throw new Error('not initialized');
    });

    const msg: StoredMessage = { ...assistantMessage, sender: '' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.textContent).toContain('Assistant');
  });

  // ---- Timestamp display ----

  it('displays formatted timestamp', () => {
    const { container } = render(<MessageBubble message={userMessage} />);
    const timeEl = container.querySelector('time');
    expect(timeEl).toBeTruthy();
    // Should contain time text (format varies by locale)
    expect(timeEl!.textContent!.length).toBeGreaterThan(0);
  });

  // ---- Markdown content rendering ----

  it('renders bold text in markdown', () => {
    const msg: StoredMessage = { ...assistantMessage, content: '**bold text**' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.textContent).toContain('bold text');
  });

  it('renders italic text in markdown', () => {
    const msg: StoredMessage = { ...assistantMessage, content: '*italic text*' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('em')).toBeTruthy();
  });

  it('renders links with target _blank', () => {
    const msg: StoredMessage = { ...assistantMessage, content: '[Click here](https://example.com)' };
    const { container } = render(<MessageBubble message={msg} />);
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('target')).toBe('_blank');
    expect(link!.getAttribute('rel')).toContain('noopener');
    expect(link!.getAttribute('href')).toBe('https://example.com');
  });

  it('renders unordered lists', () => {
    const msg: StoredMessage = { ...assistantMessage, content: '- item 1\n- item 2' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('ul')).toBeTruthy();
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('renders ordered lists', () => {
    const msg: StoredMessage = { ...assistantMessage, content: '1. first\n2. second' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('ol')).toBeTruthy();
  });

  it('renders blockquotes', () => {
    const msg: StoredMessage = { ...assistantMessage, content: '> quoted text' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('blockquote')).toBeTruthy();
  });

  it('renders headings', () => {
    const msg: StoredMessage = { ...assistantMessage, content: '# Heading 1\n## Heading 2\n### Heading 3' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.querySelector('h2')).toBeTruthy();
    expect(container.querySelector('h3')).toBeTruthy();
  });

  it('renders horizontal rules', () => {
    const msg: StoredMessage = { ...assistantMessage, content: 'before\n\n---\n\nafter' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('hr')).toBeTruthy();
  });

  it('renders tables', () => {
    const msg: StoredMessage = {
      ...assistantMessage,
      content: '| A | B |\n|---|---|\n| 1 | 2 |',
    };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('table')).toBeTruthy();
  });

  it('renders images with lazy loading', () => {
    const msg: StoredMessage = {
      ...assistantMessage,
      content: '![alt text](https://example.com/img.png)',
    };
    const { container } = render(<MessageBubble message={msg} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('loading')).toBe('lazy');
    expect(img!.getAttribute('alt')).toBe('alt text');
  });

  // ---- Code blocks ----

  it('renders fenced code blocks via CodeBlock component', () => {
    const msg: StoredMessage = {
      ...assistantMessage,
      content: '```javascript\nconsole.log("hi")\n```',
    };
    const { container } = render(<MessageBubble message={msg} />);
    const codeBlock = container.querySelector('[data-testid="code-block"]');
    expect(codeBlock).toBeTruthy();
    expect(codeBlock!.getAttribute('data-language')).toBe('javascript');
  });

  it('renders inline code as styled code element', () => {
    const msg: StoredMessage = {
      ...assistantMessage,
      content: 'Use `someVariable` here',
    };
    const { container } = render(<MessageBubble message={msg} />);
    const code = container.querySelector('code');
    expect(code).toBeTruthy();
    expect(code!.textContent).toBe('someVariable');
  });

  // ---- File path links ----

  it('renders file paths as clickable links', () => {
    const msg: StoredMessage = {
      ...assistantMessage,
      content: 'Check `src/index.ts` for details',
    };
    const { container } = render(<MessageBubble message={msg} />);
    const btn = container.querySelector('button[title="Open src/index.ts"]');
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toContain('src/index.ts');
  });

  it('calls openFile when a file link is clicked', () => {
    const msg: StoredMessage = {
      ...assistantMessage,
      content: 'Check `src/index.ts` for details',
    };
    const { container } = render(<MessageBubble message={msg} />);
    const btn = container.querySelector('button[title="Open src/index.ts"]');
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(mockOpenFile).toHaveBeenCalledWith('src/index.ts');
  });

  // ---- Paragraph rendering ----

  it('renders paragraphs with proper class', () => {
    const msg: StoredMessage = {
      ...assistantMessage,
      content: 'A paragraph of text.',
    };
    const { container } = render(<MessageBubble message={msg} />);
    const p = container.querySelector('p.my-1');
    expect(p).toBeTruthy();
  });
});
