import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '../../../src/components/chat/TypingIndicator';

describe('TypingIndicator', () => {
  it('renders three animated dots', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('span');
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it('renders without errors', () => {
    const { container } = render(<TypingIndicator />);
    expect(container).toBeTruthy();
  });
});
