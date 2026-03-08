import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { TasksPage } from '../../../src/components/tasks/TasksPage';
import type { Task } from '../../../src/types';

const mockGetAllTasks = vi.fn().mockResolvedValue([]);
const mockSaveTask = vi.fn().mockResolvedValue(undefined);
const mockDeleteTask = vi.fn().mockResolvedValue(undefined);

// Mock db operations
vi.mock('../../../src/db', () => ({
  getAllTasks: (...args: any[]) => mockGetAllTasks(...args),
  saveTask: (...args: any[]) => mockSaveTask(...args),
  deleteTask: (...args: any[]) => mockDeleteTask(...args),
}));

// Mock ulid
vi.mock('../../../src/ulid', () => ({
  ulid: () => 'test-ulid-123',
}));

describe('TasksPage', () => {
  const sampleTask: Task = {
    id: 'task-1',
    groupId: 'br:main',
    schedule: '0 9 * * *',
    prompt: 'Check for updates daily',
    enabled: true,
    lastRun: null,
    createdAt: 1700000000000,
  };

  const disabledTask: Task = {
    id: 'task-2',
    groupId: 'br:main',
    schedule: '*/5 * * * *',
    prompt: 'Monitor status every 5 min',
    enabled: false,
    lastRun: 1700000060000,
    createdAt: 1700000000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllTasks.mockResolvedValue([]);
  });

  // ---- Basic rendering ----

  it('renders the tasks page with heading', async () => {
    render(<TasksPage />);
    expect(screen.getByText('Scheduled Tasks')).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    const { container } = render(<TasksPage />);
    expect(container.querySelector('.loading-spinner')).toBeTruthy();
  });

  it('shows empty state when no tasks exist', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('No scheduled tasks')).toBeInTheDocument();
    });
  });

  // ---- Task listing ----

  it('displays task list with prompts', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask, disabledTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Check for updates daily')).toBeInTheDocument();
      expect(screen.getByText('Monitor status every 5 min')).toBeInTheDocument();
    });
  });

  it('shows human-readable schedule for tasks', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask]);
    render(<TasksPage />);
    await waitFor(() => {
      // "0 9 * * *" -> "Every day at 9:00 AM"
      expect(screen.getByText(/Every day at/)).toBeInTheDocument();
    });
  });

  it('shows cron expression in parentheses', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('(0 9 * * *)')).toBeInTheDocument();
    });
  });

  it('shows last run time when available', async () => {
    mockGetAllTasks.mockResolvedValue([disabledTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/Last run:/)).toBeInTheDocument();
    });
  });

  it('applies opacity-50 class for disabled tasks', async () => {
    mockGetAllTasks.mockResolvedValue([disabledTask]);
    const { container } = render(<TasksPage />);
    await waitFor(() => {
      const card = container.querySelector('.opacity-50');
      expect(card).toBeTruthy();
    });
  });

  // ---- Task creation form ----

  it('toggles the create form when New Task button is clicked', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText(/New Task/));
    expect(screen.getByText('Create Scheduled Task')).toBeInTheDocument();

    // Close form
    fireEvent.click(screen.getByText(/Cancel/));
    expect(screen.queryByText('Create Scheduled Task')).toBeNull();
  });

  it('shows prompt textarea in creation form', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    expect(textarea).toBeInTheDocument();
  });

  it('disables Create Task button when prompt is empty', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const createBtn = screen.getByText('Create Task');
    expect(createBtn).toBeDisabled();
  });

  it('enables Create Task button when prompt has content', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Run a check' } });

    const createBtn = screen.getByText('Create Task');
    expect(createBtn).not.toBeDisabled();
  });

  it('creates a task with daily schedule by default', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Run a check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-ulid-123',
        prompt: 'Run a check',
        enabled: true,
        schedule: '0 9 * * *', // default daily at 9:00
      })
    );
  });

  it('shows schedule preview in creation form', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    // Default is daily, should show preview
    expect(screen.getByText(/Schedule preview:/)).toBeInTheDocument();
  });

  // ---- Frequency selection ----

  it('shows time picker for daily frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    // Daily is default, should show Hour and Minute pickers
    expect(screen.getByText('Hour')).toBeInTheDocument();
    expect(screen.getByText('Minute')).toBeInTheDocument();
  });

  it('shows custom cron input for custom frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'custom' } });

    expect(screen.getByPlaceholderText('* * * * *')).toBeInTheDocument();
    expect(screen.getByText('Cron expression')).toBeInTheDocument();
  });

  it('creates task with custom cron expression', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'custom' } });

    const cronInput = screen.getByPlaceholderText('* * * * *');
    fireEvent.change(cronInput, { target: { value: '30 14 * * 1-5' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Check stuff' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '30 14 * * 1-5',
        prompt: 'Check stuff',
      })
    );
  });

  it('shows day of week picker for weekly frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'weekly' } });

    expect(screen.getByText('Day of week')).toBeInTheDocument();
  });

  it('shows day of month picker for monthly frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'monthly' } });

    expect(screen.getByText('Day of month')).toBeInTheDocument();
  });

  it('shows minute picker for hourly frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'hourly' } });

    expect(screen.getByText('At minute')).toBeInTheDocument();
  });

  // ---- Task toggle ----

  it('toggles task enabled state', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Check for updates daily')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('checkbox');
    expect(toggle).toBeChecked();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        enabled: false,
      })
    );
  });

  // ---- Task deletion ----

  it('shows delete confirmation when delete button is clicked', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Check for updates daily')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: '' }); // Trash icon button
    // Find the button with Trash icon
    const trashButtons = screen.getAllByRole('button').filter(b =>
      b.classList.contains('text-error')
    );
    await act(async () => {
      fireEvent.click(trashButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Delete task?')).toBeInTheDocument();
      expect(screen.getByText('This scheduled task will be permanently removed.')).toBeInTheDocument();
    });
  });

  it('cancels deletion when Cancel is clicked', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Check for updates daily')).toBeInTheDocument();
    });

    const trashButtons = screen.getAllByRole('button').filter(b =>
      b.classList.contains('text-error')
    );
    await act(async () => {
      fireEvent.click(trashButtons[0]);
    });
    await waitFor(() => {
      expect(screen.getByText('Delete task?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete task?')).toBeNull();
  });

  it('deletes task when confirmed', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Check for updates daily')).toBeInTheDocument();
    });

    const trashButtons = screen.getAllByRole('button').filter(b =>
      b.classList.contains('text-error')
    );
    await act(async () => {
      fireEvent.click(trashButtons[0]);
    });
    await waitFor(() => {
      expect(screen.getByText('Delete task?')).toBeInTheDocument();
    });

    const dialog = document.querySelector('dialog')!;
    const confirmDeleteBtn = dialog.querySelector('.btn-error')!;
    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
    });

    expect(mockDeleteTask).toHaveBeenCalledWith('task-1');
  });

  // ---- Day/month picker interactions ----

  it('changes day of week via the select', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'weekly' } });

    const dowSelect = screen.getByDisplayValue('Monday');
    fireEvent.change(dowSelect, { target: { value: '3' } });

    // Fill prompt and create to verify the cron uses wednesday (day 3)
    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Weekly check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '0 9 * * 3', // Wednesday
      })
    );
  });

  it('changes day of month via the select', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'monthly' } });

    const domSelect = screen.getByDisplayValue('1st');
    fireEvent.change(domSelect, { target: { value: '15' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Monthly report' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '0 9 15 * *', // 15th of month
      })
    );
  });

  it('closes delete dialog via modal backdrop button', async () => {
    mockGetAllTasks.mockResolvedValue([sampleTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Check for updates daily')).toBeInTheDocument();
    });

    const trashButtons = screen.getAllByRole('button').filter(b =>
      b.classList.contains('text-error')
    );
    await act(async () => {
      fireEvent.click(trashButtons[0]);
    });
    await waitFor(() => {
      expect(screen.getByText('Delete task?')).toBeInTheDocument();
    });

    // Click the backdrop close button
    const backdropForm = document.querySelector('.modal-backdrop');
    const closeBtn = backdropForm?.querySelector('button');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn!);

    expect(screen.queryByText('Delete task?')).toBeNull();
  });

  it('shows schedule with comma-separated day-of-week names', async () => {
    // Use a dow value where parseInt returns NaN so it falls through to the comma branch
    const multiDayTask: Task = {
      id: 'task-multi',
      groupId: 'br:main',
      schedule: '30 10 * * MON,WED',
      prompt: 'Multi day task',
      enabled: true,
      lastRun: null,
      createdAt: 1700000000000,
    };
    mockGetAllTasks.mockResolvedValue([multiDayTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Multi day task')).toBeInTheDocument();
    });
    // parseInt("MON,WED") is NaN, so it falls through to comma-split branch
    // Names that don't parse as numbers stay as-is
    expect(screen.getByText(/Every MON, WED at/)).toBeInTheDocument();
  });

  it('shows monthly schedule with ordinal day', async () => {
    const monthlyTask: Task = {
      id: 'task-monthly',
      groupId: 'br:main',
      schedule: '0 8 15 * *',
      prompt: 'Monthly report',
      enabled: true,
      lastRun: null,
      createdAt: 1700000000000,
    };
    mockGetAllTasks.mockResolvedValue([monthlyTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Monthly report')).toBeInTheDocument();
    });
    // Should show "Monthly on the 15th at 8:00 AM"
    expect(screen.getByText(/15th/)).toBeInTheDocument();
  });

  it('creates task with custom cron defaulting to * * * * * when empty', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'custom' } });

    // Leave custom cron empty
    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Run always' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '* * * * *', // default when custom is empty
      })
    );
  });

  it('changes hour and minute in time picker', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    // Daily is default so time picker is shown. Find selects by their container labels.
    const hourLabel = screen.getByText('Hour');
    const hourSelect = hourLabel.closest('.form-control')!.querySelector('select')!;
    fireEvent.change(hourSelect, { target: { value: '14' } });

    const minuteLabel = screen.getByText('Minute');
    const minuteSelect = minuteLabel.closest('.form-control')!.querySelector('select')!;
    fireEvent.change(minuteSelect, { target: { value: '30' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Afternoon check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '30 14 * * *',
      })
    );
  });

  it('creates task with every-minute frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'every-minute' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Frequent check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '* * * * *',
      })
    );
  });

  it('creates task with weekdays frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'weekdays' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Weekday check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '0 9 * * 1-5',
      })
    );
  });

  it('changes minute in hourly minute picker', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'hourly' } });

    const minuteLabel = screen.getByText('At minute');
    const minuteSelect = minuteLabel.closest('.form-control')!.querySelector('select')!;
    fireEvent.change(minuteSelect, { target: { value: '15' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Hourly check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '15 * * * *',
      })
    );
  });

  // ---- Additional frequency presets ----

  it('creates task with every-5-min frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'every-5-min' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Quick check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '*/5 * * * *',
      })
    );
  });

  it('creates task with every-15-min frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'every-15-min' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Regular check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '*/15 * * * *',
      })
    );
  });

  it('creates task with every-30-min frequency', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const freqSelect = screen.getByDisplayValue('Every day');
    fireEvent.change(freqSelect, { target: { value: 'every-30-min' } });

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Half-hourly check' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    expect(mockSaveTask).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: '*/30 * * * *',
      })
    );
  });

  it('displays raw cron for unrecognized cron format', async () => {
    const weirdTask: Task = {
      id: 'task-weird',
      groupId: 'br:main',
      schedule: '*/2 */3 1-15 1,6 *',
      prompt: 'Complex schedule',
      enabled: true,
      lastRun: null,
      createdAt: 1700000000000,
    };
    mockGetAllTasks.mockResolvedValue([weirdTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Complex schedule')).toBeInTheDocument();
    });
    // cronToHuman should fall through to returning the raw cron
    expect(screen.getByText('*/2 */3 1-15 1,6 *')).toBeInTheDocument();
  });

  it('displays invalid cron with wrong parts count as-is', async () => {
    const badCronTask: Task = {
      id: 'task-bad',
      groupId: 'br:main',
      schedule: 'invalid cron',
      prompt: 'Bad cron task',
      enabled: true,
      lastRun: null,
      createdAt: 1700000000000,
    };
    mockGetAllTasks.mockResolvedValue([badCronTask]);
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText('Bad cron task')).toBeInTheDocument();
    });
    // cronToHuman returns cron as-is when parts.length !== 5
    expect(screen.getByText('invalid cron')).toBeInTheDocument();
  });

  // ---- Form closes after creation ----

  it('closes form and reloads tasks after creation', async () => {
    render(<TasksPage />);
    await waitFor(() => {
      expect(screen.getByText(/New Task/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/New Task/));

    const textarea = screen.getByPlaceholderText('What should the assistant do on this schedule?');
    fireEvent.change(textarea, { target: { value: 'Run something' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Create Task'));
    });

    // Form should close
    expect(screen.queryByText('Create Scheduled Task')).toBeNull();
    // Tasks should be reloaded
    expect(mockGetAllTasks).toHaveBeenCalledTimes(2); // initial + after create
  });
});
