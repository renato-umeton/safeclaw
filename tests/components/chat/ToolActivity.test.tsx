import { render, screen } from '@testing-library/react';
import { ToolActivity } from '../../../src/components/chat/ToolActivity';

describe('ToolActivity', () => {
  it('renders tool name when active', () => {
    render(<ToolActivity tool="bash" status="running" />);
    expect(screen.getByText(/bash/i)).toBeInTheDocument();
  });

  it('renders without errors', () => {
    const { container } = render(<ToolActivity tool="read_file" status="running" />);
    expect(container).toBeTruthy();
  });
});
