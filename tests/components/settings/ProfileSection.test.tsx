import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProfileSection } from '../../../src/components/settings/ProfileSection';

const mockSaveUserProfile = vi.fn().mockResolvedValue(undefined);
const mockGetUserProfile = vi.fn().mockResolvedValue(null);
const mockClearUserProfile = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../src/db', () => ({
  saveUserProfile: (...args: any[]) => mockSaveUserProfile(...args),
  getUserProfile: (...args: any[]) => mockGetUserProfile(...args),
  clearUserProfile: (...args: any[]) => mockClearUserProfile(...args),
}));

describe('ProfileSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetUserProfile.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders profile section heading', () => {
    render(<ProfileSection />);
    expect(screen.getByText('Your Profile')).toBeInTheDocument();
  });

  it('renders resume textarea', () => {
    render(<ProfileSection />);
    expect(screen.getByPlaceholderText(/resume.*skills/i)).toBeInTheDocument();
  });

  it('renders input fields for all 5 social platforms', () => {
    render(<ProfileSection />);
    expect(screen.getByPlaceholderText(/linkedin/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/instagram/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/github/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/twitter/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/reddit/i)).toBeInTheDocument();
  });

  it('loads existing profile data on mount', async () => {
    mockGetUserProfile.mockResolvedValue({
      resumeText: 'Python developer',
      socialLinks: {
        linkedin: 'https://linkedin.com/in/dev',
        instagram: '',
        github: 'https://github.com/dev',
        twitter: '',
        reddit: '',
      },
    });

    await act(async () => {
      render(<ProfileSection />);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/resume.*skills/i)).toHaveValue('Python developer');
      expect(screen.getByPlaceholderText(/linkedin/i)).toHaveValue('https://linkedin.com/in/dev');
      expect(screen.getByPlaceholderText(/github/i)).toHaveValue('https://github.com/dev');
    });
  });

  it('saves profile when Save Profile button is clicked', async () => {
    render(<ProfileSection />);

    const textarea = screen.getByPlaceholderText(/resume.*skills/i);
    fireEvent.change(textarea, { target: { value: 'Full stack developer' } });

    const githubInput = screen.getByPlaceholderText(/github/i);
    fireEvent.change(githubInput, { target: { value: 'https://github.com/test' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Profile'));
    });

    expect(mockSaveUserProfile).toHaveBeenCalledWith(expect.objectContaining({
      resumeText: 'Full stack developer',
      socialLinks: expect.objectContaining({
        github: 'https://github.com/test',
      }),
    }));
  });

  it('shows saved confirmation after saving', async () => {
    render(<ProfileSection />);

    const textarea = screen.getByPlaceholderText(/resume.*skills/i);
    fireEvent.change(textarea, { target: { value: 'Test' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Profile'));
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('clears profile when Clear Profile button is clicked', async () => {
    mockGetUserProfile.mockResolvedValue({
      resumeText: 'Some text',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    });

    await act(async () => {
      render(<ProfileSection />);
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/resume.*skills/i)).toHaveValue('Some text');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Clear Profile'));
    });

    expect(mockClearUserProfile).toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/resume.*skills/i)).toHaveValue('');
  });

  it('handles empty profile (no prior data) gracefully', async () => {
    mockGetUserProfile.mockResolvedValue(null);

    await act(async () => {
      render(<ProfileSection />);
    });

    expect(screen.getByPlaceholderText(/resume.*skills/i)).toHaveValue('');
  });
});
