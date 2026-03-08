import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../../../src/components/layout/ThemeToggle';

const mockSetTheme = vi.fn();

vi.mock('../../../src/stores/theme-store', () => ({
  useThemeStore: vi.fn(() => ({
    theme: 'system' as const,
    resolved: 'light' as const,
    setTheme: mockSetTheme,
  })),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a dropdown with theme buttons', () => {
    render(<ThemeToggle />);
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });

  it('renders all three theme options', () => {
    render(<ThemeToggle />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('calls setTheme when option is clicked', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('marks current theme as active', () => {
    render(<ThemeToggle />);
    const systemButton = screen.getByText('System').closest('button')!;
    expect(systemButton.className).toContain('active');
    const darkButton = screen.getByText('Dark').closest('button')!;
    expect(darkButton.className).not.toContain('active');
  });
});
