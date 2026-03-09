import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UseCasesPage } from '../../../src/components/use-cases/UseCasesPage';
import { USE_CASES, getAllCategories } from '../../../src/use-cases';

const mockGetUserProfile = vi.fn().mockResolvedValue(null);

vi.mock('../../../src/db', () => ({
  getUserProfile: (...args: any[]) => mockGetUserProfile(...args),
}));

describe('UseCasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserProfile.mockResolvedValue(null);
  });

  describe('without profile', () => {
    it('renders page heading', async () => {
      await act(async () => { render(<UseCasesPage />); });
      expect(screen.getByText('Use Cases')).toBeInTheDocument();
    });

    it('renders all use cases from catalog', async () => {
      await act(async () => { render(<UseCasesPage />); });
      for (const uc of USE_CASES) {
        expect(screen.getByText(uc.title)).toBeInTheDocument();
      }
    });

    it('displays use case descriptions', async () => {
      await act(async () => { render(<UseCasesPage />); });
      // Check at least the first use case description is rendered
      const firstDesc = USE_CASES[0].description;
      expect(screen.getByText(firstDesc)).toBeInTheDocument();
    });

    it('displays category badges', async () => {
      await act(async () => { render(<UseCasesPage />); });
      const categories = getAllCategories();
      for (const cat of categories) {
        // At least one badge for each category
        expect(screen.getAllByText(cat).length).toBeGreaterThan(0);
      }
    });

    it('displays difficulty badges', async () => {
      await act(async () => { render(<UseCasesPage />); });
      expect(screen.getAllByText(/beginner/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/intermediate/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/advanced/i).length).toBeGreaterThan(0);
    });

    it('does not show recommended section when no profile', async () => {
      await act(async () => { render(<UseCasesPage />); });
      expect(screen.queryByText('Recommended for You')).toBeNull();
    });
  });

  describe('filtering', () => {
    it('filters by category when dropdown changes', async () => {
      await act(async () => { render(<UseCasesPage />); });

      const categorySelect = screen.getByRole('combobox', { name: /category/i });
      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: 'Development' } });
      });

      // Should show only Development use cases
      const devCases = USE_CASES.filter((uc) => uc.category === 'Development');
      const nonDevCases = USE_CASES.filter((uc) => uc.category !== 'Development');
      for (const uc of devCases) {
        expect(screen.getByText(uc.title)).toBeInTheDocument();
      }
      for (const uc of nonDevCases) {
        expect(screen.queryByText(uc.title)).toBeNull();
      }
    });

    it('filters by difficulty when dropdown changes', async () => {
      await act(async () => { render(<UseCasesPage />); });

      const diffSelect = screen.getByRole('combobox', { name: /difficulty/i });
      await act(async () => {
        fireEvent.change(diffSelect, { target: { value: 'beginner' } });
      });

      const beginnerCases = USE_CASES.filter((uc) => uc.difficulty === 'beginner');
      for (const uc of beginnerCases) {
        expect(screen.getByText(uc.title)).toBeInTheDocument();
      }
    });

    it('filters by search text', async () => {
      await act(async () => { render(<UseCasesPage />); });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Telegram' } });
      });

      // Only use cases with "Telegram" in title or description should show
      expect(screen.getByText('Telegram Team Assistant')).toBeInTheDocument();
      // Others should be hidden
      expect(screen.queryByText('CSV Data Exploration')).toBeNull();
    });

    it('shows empty state when filters exclude everything', async () => {
      await act(async () => { render(<UseCasesPage />); });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });
      });

      expect(screen.getByText(/no use cases match/i)).toBeInTheDocument();
    });

    it('resets filters when reset button is clicked', async () => {
      await act(async () => { render(<UseCasesPage />); });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });
      });

      expect(screen.getByText(/no use cases match/i)).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText(/reset/i));
      });

      // All use cases should be visible again
      for (const uc of USE_CASES) {
        expect(screen.getByText(uc.title)).toBeInTheDocument();
      }
    });
  });

  describe('with profile (personalization)', () => {
    it('shows recommended section when profile exists', async () => {
      mockGetUserProfile.mockResolvedValue({
        resumeText: 'Python developer with machine learning experience',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: 'https://github.com/dev', twitter: '', reddit: '' },
      });

      await act(async () => { render(<UseCasesPage />); });

      await waitFor(() => {
        expect(screen.getByText('Recommended for You')).toBeInTheDocument();
      });
    });

    it('displays top 5 recommended use cases', async () => {
      mockGetUserProfile.mockResolvedValue({
        resumeText: 'Python developer with machine learning experience',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: 'https://github.com/dev', twitter: '', reddit: '' },
      });

      await act(async () => { render(<UseCasesPage />); });

      await waitFor(() => {
        const recSection = screen.getByText('Recommended for You').closest('div')!;
        const cards = recSection.querySelectorAll('[data-testid="rec-card"]');
        expect(cards.length).toBeLessThanOrEqual(5);
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    it('loads user profile on mount', async () => {
      await act(async () => { render(<UseCasesPage />); });
      expect(mockGetUserProfile).toHaveBeenCalled();
    });

    it('shows WHY explanation with matched keywords for recommendations', async () => {
      mockGetUserProfile.mockResolvedValue({
        resumeText: 'Python developer with machine learning experience',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: 'https://github.com/dev', twitter: '', reddit: '' },
      });

      await act(async () => { render(<UseCasesPage />); });

      await waitFor(() => {
        // Should show "Why:" labels for recommendations
        const whyElements = screen.getAllByText(/^Why:/);
        expect(whyElements.length).toBeGreaterThan(0);
      });
    });

    it('shows match strength indicator for recommendations', async () => {
      mockGetUserProfile.mockResolvedValue({
        resumeText: 'Python developer with machine learning experience',
        cvFileName: '',
        socialLinks: { linkedin: '', instagram: '', github: 'https://github.com/dev', twitter: '', reddit: '' },
      });

      await act(async () => { render(<UseCasesPage />); });

      await waitFor(() => {
        const matchBars = document.querySelectorAll('[data-testid="match-bar"]');
        expect(matchBars.length).toBeGreaterThan(0);
      });
    });
  });
});
