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
      cvFileName: '',
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
      cvFileName: '',
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

  // --- CV Upload tests ---

  it('renders CV upload button', () => {
    render(<ProfileSection />);
    expect(screen.getByText(/upload cv/i)).toBeInTheDocument();
  });

  it('renders a file input that accepts text and PDF files', () => {
    render(<ProfileSection />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe('.txt,.md,.pdf');
  });

  it('reads uploaded text file and populates resume textarea', async () => {
    render(<ProfileSection />);

    const cvContent = 'Senior software engineer with 10 years experience in Python and JavaScript';
    const file = new File([cvContent], 'my_cv.txt', { type: 'text/plain' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Wait for file reading to complete
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/resume.*skills/i)).toHaveValue(cvContent);
    });
  });

  it('displays uploaded file name after upload', async () => {
    render(<ProfileSection />);

    const file = new File(['Resume content here'], 'john_doe_resume.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText('john_doe_resume.txt')).toBeInTheDocument();
    });
  });

  it('saves cvFileName when profile is saved', async () => {
    render(<ProfileSection />);

    const file = new File(['CV content'], 'resume.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText('resume.txt')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Profile'));
    });

    expect(mockSaveUserProfile).toHaveBeenCalledWith(expect.objectContaining({
      cvFileName: 'resume.txt',
    }));
  });

  it('loads existing cvFileName on mount', async () => {
    mockGetUserProfile.mockResolvedValue({
      resumeText: 'CV content from upload',
      cvFileName: 'uploaded_cv.txt',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    });

    await act(async () => {
      render(<ProfileSection />);
    });

    await waitFor(() => {
      expect(screen.getByText('uploaded_cv.txt')).toBeInTheDocument();
    });
  });

  it('clears cvFileName when profile is cleared', async () => {
    mockGetUserProfile.mockResolvedValue({
      resumeText: 'Some text',
      cvFileName: 'old_cv.txt',
      socialLinks: { linkedin: '', instagram: '', github: '', twitter: '', reddit: '' },
    });

    await act(async () => {
      render(<ProfileSection />);
    });

    await waitFor(() => {
      expect(screen.getByText('old_cv.txt')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Clear Profile'));
    });

    expect(screen.queryByText('old_cv.txt')).toBeNull();
  });

  it('ignores file input change when no files selected', async () => {
    render(<ProfileSection />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [] } });
    });

    // Resume should remain empty
    expect(screen.getByPlaceholderText(/resume.*skills/i)).toHaveValue('');
  });
});
