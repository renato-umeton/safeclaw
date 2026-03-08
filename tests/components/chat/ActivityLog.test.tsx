import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityLog } from '../../../src/components/chat/ActivityLog';
import type { ThinkingLogEntry } from '../../../src/types';

describe('ActivityLog', () => {
  const baseEntry: ThinkingLogEntry = {
    groupId: 'br:main',
    kind: 'info',
    timestamp: 1700000000000,
    label: 'Starting',
    detail: 'Provider: Anthropic',
  };

  const entries: ThinkingLogEntry[] = [
    baseEntry,
    {
      groupId: 'br:main',
      kind: 'api-call',
      timestamp: 1700000001000,
      label: 'API call #1',
      detail: '5 messages',
    },
    {
      groupId: 'br:main',
      kind: 'tool-call',
      timestamp: 1700000002000,
      label: 'Tool: bash',
      detail: '{"command":"ls"}',
    },
    {
      groupId: 'br:main',
      kind: 'tool-result',
      timestamp: 1700000003000,
      label: 'Result: bash',
      detail: 'file1.txt\nfile2.txt',
    },
    {
      groupId: 'br:main',
      kind: 'text',
      timestamp: 1700000004000,
      label: 'Text block',
      detail: 'Some response text',
    },
  ];

  // ---- Basic rendering ----

  it('renders activity label with entry count badge', () => {
    const { container } = render(<ActivityLog entries={entries} />);
    expect(container.textContent).toContain('Activity');
    expect(container.textContent).toContain(String(entries.length));
  });

  it('renders empty state with zero count', () => {
    const { container } = render(<ActivityLog entries={[]} />);
    expect(container.textContent).toContain('Activity');
    expect(container.textContent).toContain('0');
  });

  // ---- Different log entry types ----

  it('renders info entries with label', () => {
    const { container } = render(<ActivityLog entries={[baseEntry]} />);
    expect(container.textContent).toContain('Starting');
    expect(container.textContent).toContain('Provider: Anthropic');
  });

  it('renders api-call entries', () => {
    const { container } = render(<ActivityLog entries={entries} />);
    expect(container.textContent).toContain('API call #1');
    expect(container.textContent).toContain('5 messages');
  });

  it('renders tool-call entries', () => {
    const { container } = render(<ActivityLog entries={entries} />);
    expect(container.textContent).toContain('Tool: bash');
  });

  it('renders tool-result entries', () => {
    const { container } = render(<ActivityLog entries={entries} />);
    expect(container.textContent).toContain('Result: bash');
  });

  it('renders text entries', () => {
    const { container } = render(<ActivityLog entries={entries} />);
    expect(container.textContent).toContain('Text block');
  });

  // ---- Entry without detail ----

  it('renders entry without detail field', () => {
    const noDetailEntry: ThinkingLogEntry = {
      groupId: 'br:main',
      kind: 'info',
      timestamp: 1700000000000,
      label: 'Simple info',
    };
    const { container } = render(<ActivityLog entries={[noDetailEntry]} />);
    expect(container.textContent).toContain('Simple info');
  });

  // ---- Entry with unknown kind (bullet fallback) ----

  it('renders bullet for unknown kind', () => {
    const unknownKindEntry: ThinkingLogEntry = {
      groupId: 'br:main',
      kind: 'unknown-kind' as any,
      timestamp: 1700000000000,
      label: 'Unknown entry',
    };
    const { container } = render(<ActivityLog entries={[unknownKindEntry]} />);
    expect(container.textContent).toContain('Unknown entry');
    // Should render bullet instead of icon
    const items = container.querySelectorAll('.flex.items-start');
    // Find the one containing a bullet
    let hasBullet = false;
    items.forEach(item => {
      if (item.innerHTML.includes('•')) hasBullet = true;
    });
    expect(hasBullet).toBe(true);
  });

  // ---- Collapsible behavior ----

  it('is collapsed by default', () => {
    const { container } = render(<ActivityLog entries={entries} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(false);
  });

  it('expands when checkbox is toggled', () => {
    const { container } = render(<ActivityLog entries={entries} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  // ---- Long detail expand/collapse ----

  it('shows expand button for long details (>120 chars)', () => {
    const longDetailEntry: ThinkingLogEntry = {
      groupId: 'br:main',
      kind: 'info',
      timestamp: 1700000000000,
      label: 'Long detail entry',
      detail: 'A'.repeat(150),
    };
    const { container } = render(<ActivityLog entries={[longDetailEntry]} />);
    expect(container.textContent).toContain('expand');
  });

  it('does not show expand button for short details', () => {
    const shortDetailEntry: ThinkingLogEntry = {
      groupId: 'br:main',
      kind: 'info',
      timestamp: 1700000000000,
      label: 'Short detail entry',
      detail: 'Short text',
    };
    const { container } = render(<ActivityLog entries={[shortDetailEntry]} />);
    expect(container.textContent).not.toContain('expand');
  });

  it('toggles between expand and collapse for long details', () => {
    const longDetailEntry: ThinkingLogEntry = {
      groupId: 'br:main',
      kind: 'info',
      timestamp: 1700000000000,
      label: 'Long detail entry',
      detail: 'A'.repeat(150),
    };
    render(<ActivityLog entries={[longDetailEntry]} />);

    // Initially shows expand
    const expandBtn = screen.getByText('expand');
    expect(expandBtn).toBeInTheDocument();

    // Click to expand
    fireEvent.click(expandBtn);
    expect(screen.getByText('collapse')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('collapse'));
    expect(screen.getByText('expand')).toBeInTheDocument();
  });

  it('applies line-clamp-1 class when detail is long and not expanded', () => {
    const longDetailEntry: ThinkingLogEntry = {
      groupId: 'br:main',
      kind: 'info',
      timestamp: 1700000000000,
      label: 'Long detail entry',
      detail: 'B'.repeat(150),
    };
    const { container } = render(<ActivityLog entries={[longDetailEntry]} />);
    expect(container.querySelector('.line-clamp-1')).toBeTruthy();
  });

  it('removes line-clamp-1 class when detail is expanded', () => {
    const longDetailEntry: ThinkingLogEntry = {
      groupId: 'br:main',
      kind: 'info',
      timestamp: 1700000000000,
      label: 'Long detail entry',
      detail: 'C'.repeat(150),
    };
    const { container } = render(<ActivityLog entries={[longDetailEntry]} />);

    fireEvent.click(screen.getByText('expand'));
    expect(container.querySelector('.line-clamp-1')).toBeNull();
  });

  // ---- Timestamp formatting ----

  it('displays formatted timestamps for entries', () => {
    const { container } = render(<ActivityLog entries={[baseEntry]} />);
    // Should display time in HH:MM:SS format (locale-dependent)
    const timeSpans = container.querySelectorAll('.opacity-50.shrink-0');
    expect(timeSpans.length).toBeGreaterThan(0);
    expect(timeSpans[0].textContent!.length).toBeGreaterThan(0);
  });
});
