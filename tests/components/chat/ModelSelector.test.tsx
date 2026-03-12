import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '../../../src/components/chat/ModelSelector';

const mockSetProviderId = vi.fn();
const mockSetModel = vi.fn();

let currentState: any = {
  providerId: 'anthropic',
  model: 'claude-sonnet-4-6',
  state: 'idle',
  setProviderId: mockSetProviderId,
  setModel: mockSetModel,
};

vi.mock('../../../src/stores/orchestrator-store', () => {
  const store: any = vi.fn((selector: any) => {
    return selector ? selector(currentState) : currentState;
  });
  store.getState = () => currentState;
  return { useOrchestratorStore: store };
});

describe('ModelSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentState = {
      providerId: 'anthropic',
      model: 'claude-sonnet-4-6',
      state: 'idle',
      setProviderId: mockSetProviderId,
      setModel: mockSetModel,
    };
  });

  it('renders with the current model label', () => {
    render(<ModelSelector />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // Should have the current model selected
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('anthropic:claude-sonnet-4-6');
  });

  it('shows all models grouped by provider', () => {
    render(<ModelSelector />);
    const options = screen.getAllByRole('option');
    // All models across all providers should be listed
    expect(options.length).toBeGreaterThanOrEqual(11); // 3 + 3 + 4 + 1
  });

  it('shows provider group labels', () => {
    const { container } = render(<ModelSelector />);
    const optgroups = container.querySelectorAll('optgroup');
    expect(optgroups.length).toBe(4);
    expect(optgroups[0].getAttribute('label')).toBe('Anthropic Claude');
    expect(optgroups[1].getAttribute('label')).toBe('Google Gemini');
  });

  it('calls setProviderId and setModel when a different model is selected', async () => {
    render(<ModelSelector />);
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'gemini:gemini-2.0-flash');
    expect(mockSetProviderId).toHaveBeenCalledWith('gemini');
    expect(mockSetModel).toHaveBeenCalledWith('gemini-2.0-flash');
  });

  it('calls setModel without setProviderId when selecting a model from the same provider', async () => {
    render(<ModelSelector />);
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'anthropic:claude-opus-4-6');
    expect(mockSetProviderId).not.toHaveBeenCalled();
    expect(mockSetModel).toHaveBeenCalledWith('claude-opus-4-6');
  });

  it('is disabled when orchestrator is not idle', () => {
    currentState = { ...currentState, state: 'thinking' };
    render(<ModelSelector />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('is enabled when orchestrator is idle', () => {
    render(<ModelSelector />);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });
});
