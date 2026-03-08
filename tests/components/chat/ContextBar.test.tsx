import { render } from '@testing-library/react';
import { ContextBar } from '../../../src/components/chat/ContextBar';
import type { TokenUsage } from '../../../src/types';

describe('ContextBar', () => {
  const usage: TokenUsage = {
    groupId: 'br:main',
    inputTokens: 50_000,
    outputTokens: 5_000,
    cacheReadTokens: 10_000,
    cacheCreationTokens: 1_000,
    contextLimit: 200_000,
  };

  it('renders without errors', () => {
    const { container } = render(<ContextBar usage={usage} />);
    expect(container).toBeTruthy();
  });

  it('displays token counts', () => {
    const { container } = render(<ContextBar usage={usage} />);
    // Should contain numeric content like "55.0k / 200.0k tokens"
    expect(container.textContent).toBeTruthy();
  });

  it('shows cache info when cache tokens > 0', () => {
    const { container } = render(<ContextBar usage={usage} />);
    expect(container.textContent).toContain('cached');
  });

  it('shows different colors based on usage percentage', () => {
    const highUsage: TokenUsage = {
      ...usage,
      inputTokens: 180_000,
    };
    const { container } = render(<ContextBar usage={highUsage} />);
    const progress = container.querySelector('progress');
    expect(progress?.className).toContain('progress-error');
  });

  it('shows warning color for 60-80% usage', () => {
    const midUsage: TokenUsage = {
      ...usage,
      inputTokens: 130_000,
      outputTokens: 5_000,
    };
    const { container } = render(<ContextBar usage={midUsage} />);
    const progress = container.querySelector('progress');
    expect(progress?.className).toContain('progress-warning');
  });

  it('shows success color for low usage', () => {
    const lowUsage: TokenUsage = {
      ...usage,
      inputTokens: 10_000,
      outputTokens: 1_000,
    };
    const { container } = render(<ContextBar usage={lowUsage} />);
    const progress = container.querySelector('progress');
    expect(progress?.className).toContain('progress-success');
  });

  it('formats tokens below 1000 as plain numbers', () => {
    const smallUsage: TokenUsage = {
      groupId: 'br:main',
      inputTokens: 500,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      contextLimit: 200_000,
    };
    const { container } = render(<ContextBar usage={smallUsage} />);
    expect(container.textContent).toContain('600');
  });

  it('does not show cache info when cacheReadTokens is 0', () => {
    const noCacheUsage: TokenUsage = {
      ...usage,
      cacheReadTokens: 0,
    };
    const { container } = render(<ContextBar usage={noCacheUsage} />);
    expect(container.textContent).not.toContain('cached');
  });
});
