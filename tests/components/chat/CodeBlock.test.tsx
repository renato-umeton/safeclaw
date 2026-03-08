import { render, screen, fireEvent } from '@testing-library/react';
import { CodeBlock } from '../../../src/components/chat/CodeBlock';

describe('CodeBlock', () => {
  it('renders code content', () => {
    render(<CodeBlock code="const x = 1;" language="javascript" />);
    expect(screen.getByText(/const x = 1/)).toBeInTheDocument();
  });

  it('renders language label when provided', () => {
    const { container } = render(<CodeBlock code="print('hi')" language="python" />);
    expect(container.textContent).toContain('python');
  });

  it('renders copy button', () => {
    render(<CodeBlock code="test" language="text" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('copies code on button click', async () => {
    // Mock clipboard API (navigator.clipboard has a getter, so use defineProperty)
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CodeBlock code="copy me" language="text" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(writeTextMock).toHaveBeenCalledWith('copy me');
  });
});
