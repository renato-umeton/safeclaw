import { matchesCron, TaskScheduler } from '../src/task-scheduler';

// Mock the db module
vi.mock('../src/db.js', () => ({
  getEnabledTasks: vi.fn().mockResolvedValue([]),
  updateTaskLastRun: vi.fn().mockResolvedValue(undefined),
}));

import { getEnabledTasks, updateTaskLastRun } from '../src/db.js';

describe('matchesCron', () => {
  it('matches wildcard expression (* * * * *)', () => {
    expect(matchesCron('* * * * *', new Date())).toBe(true);
  });

  it('matches specific minute', () => {
    const date = new Date(2024, 0, 1, 12, 30);
    expect(matchesCron('30 * * * *', date)).toBe(true);
    expect(matchesCron('15 * * * *', date)).toBe(false);
  });

  it('matches specific hour', () => {
    const date = new Date(2024, 0, 1, 9, 0);
    expect(matchesCron('0 9 * * *', date)).toBe(true);
    expect(matchesCron('0 10 * * *', date)).toBe(false);
  });

  it('matches day of month', () => {
    const date = new Date(2024, 0, 15, 0, 0);
    expect(matchesCron('0 0 15 * *', date)).toBe(true);
    expect(matchesCron('0 0 16 * *', date)).toBe(false);
  });

  it('matches month', () => {
    const date = new Date(2024, 5, 1, 0, 0); // June (month index 5 = month 6)
    expect(matchesCron('0 0 1 6 *', date)).toBe(true);
    expect(matchesCron('0 0 1 7 *', date)).toBe(false);
  });

  it('matches day of week (0=Sunday)', () => {
    const monday = new Date(2024, 0, 1); // Jan 1 2024 is Monday (1)
    expect(matchesCron('* * * * 1', monday)).toBe(true);
    expect(matchesCron('* * * * 0', monday)).toBe(false);
  });

  it('supports ranges (1-5)', () => {
    const wednesday = new Date(2024, 0, 3); // Wednesday (3)
    expect(matchesCron('* * * * 1-5', wednesday)).toBe(true);
    const sunday = new Date(2024, 0, 7); // Sunday (0)
    expect(matchesCron('* * * * 1-5', sunday)).toBe(false);
  });

  it('supports lists (1,3,5)', () => {
    const date = new Date(2024, 0, 1, 12, 15);
    expect(matchesCron('15,30,45 * * * *', date)).toBe(true);
    expect(matchesCron('10,20,40 * * * *', date)).toBe(false);
  });

  it('supports step values (*/5)', () => {
    const date = new Date(2024, 0, 1, 12, 10);
    expect(matchesCron('*/5 * * * *', date)).toBe(true);
    const date2 = new Date(2024, 0, 1, 12, 7);
    expect(matchesCron('*/5 * * * *', date2)).toBe(false);
  });

  it('supports range with step (1-10/2)', () => {
    const date3 = new Date(2024, 0, 1, 12, 3);
    expect(matchesCron('1-10/2 * * * *', date3)).toBe(true); // 1,3,5,7,9
    const date4 = new Date(2024, 0, 1, 12, 4);
    expect(matchesCron('1-10/2 * * * *', date4)).toBe(false);
  });

  it('returns false for invalid expressions', () => {
    expect(matchesCron('invalid', new Date())).toBe(false);
    expect(matchesCron('* * *', new Date())).toBe(false);
  });

  it('common patterns work correctly', () => {
    // Every day at 9am
    const nine = new Date(2024, 0, 1, 9, 0);
    expect(matchesCron('0 9 * * *', nine)).toBe(true);

    // Weekdays at 9am
    const mondayNine = new Date(2024, 0, 1, 9, 0); // Monday
    expect(matchesCron('0 9 * * 1-5', mondayNine)).toBe(true);
  });

  it('supports day-of-week ranges for weekends', () => {
    const saturday = new Date(2024, 0, 6); // Saturday (6)
    expect(matchesCron('* * * * 6-7', saturday)).toBe(true);
    expect(matchesCron('* * * * 0,6', saturday)).toBe(true);
    const sunday = new Date(2024, 0, 7); // Sunday (0)
    expect(matchesCron('* * * * 0,6', sunday)).toBe(true);
  });

  it('supports step on hours (*/2)', () => {
    const date0 = new Date(2024, 0, 1, 0, 0);
    expect(matchesCron('0 */2 * * *', date0)).toBe(true);
    const date4 = new Date(2024, 0, 1, 4, 0);
    expect(matchesCron('0 */2 * * *', date4)).toBe(true);
    const date3 = new Date(2024, 0, 1, 3, 0);
    expect(matchesCron('0 */2 * * *', date3)).toBe(false);
  });

  it('supports start/step (5/10) — matches 5, 15, 25...', () => {
    const date5 = new Date(2024, 0, 1, 0, 5);
    expect(matchesCron('5/10 * * * *', date5)).toBe(true);
    const date15 = new Date(2024, 0, 1, 0, 15);
    expect(matchesCron('5/10 * * * *', date15)).toBe(true);
    const date6 = new Date(2024, 0, 1, 0, 6);
    expect(matchesCron('5/10 * * * *', date6)).toBe(false);
  });

  it('handles step with invalid step value', () => {
    const date = new Date(2024, 0, 1, 0, 0);
    expect(matchesCron('*/0 * * * *', date)).toBe(false);
    expect(matchesCron('*/abc * * * *', date)).toBe(false);
  });

  it('matches day-of-month range', () => {
    const date10 = new Date(2024, 0, 10, 0, 0);
    expect(matchesCron('0 0 1-15 * *', date10)).toBe(true);
    const date20 = new Date(2024, 0, 20, 0, 0);
    expect(matchesCron('0 0 1-15 * *', date20)).toBe(false);
  });

  it('matches month range', () => {
    const jan = new Date(2024, 0, 1, 0, 0);
    expect(matchesCron('0 0 * 1-6 *', jan)).toBe(true);
    const aug = new Date(2024, 7, 1, 0, 0);
    expect(matchesCron('0 0 * 1-6 *', aug)).toBe(false);
  });

  it('supports list with ranges mixed (1,10-15)', () => {
    const date1 = new Date(2024, 0, 1, 0, 1);
    expect(matchesCron('1,10-15 * * * *', date1)).toBe(true);
    const date12 = new Date(2024, 0, 1, 0, 12);
    expect(matchesCron('1,10-15 * * * *', date12)).toBe(true);
    const date5 = new Date(2024, 0, 1, 0, 5);
    expect(matchesCron('1,10-15 * * * *', date5)).toBe(false);
  });
});

describe('TaskScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates with a runner function', () => {
    const runner = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);
    expect(scheduler).toBeDefined();
  });

  it('start and stop lifecycle', () => {
    vi.useFakeTimers();
    const runner = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);

    scheduler.start();
    // Calling start again is idempotent
    scheduler.start();

    scheduler.stop();
    scheduler.stop(); // idempotent
    vi.useRealTimers();
  });

  it('does not start when already running', () => {
    vi.useFakeTimers();
    const runner = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);

    scheduler.start();
    scheduler.start(); // second call is no-op

    scheduler.stop();
    vi.useRealTimers();
  });

  it('tick executes due tasks', async () => {
    vi.useFakeTimers();
    const now = new Date(2024, 0, 1, 9, 0);
    vi.setSystemTime(now);

    const runner = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);

    const mockTask = {
      id: 'task-1',
      groupId: 'test-group',
      schedule: '0 9 * * *',
      prompt: 'Do something',
      enabled: true,
      lastRun: null,
      createdAt: Date.now(),
    };

    vi.mocked(getEnabledTasks).mockResolvedValue([mockTask]);

    scheduler.start(); // calls tick immediately

    // Allow the async tick to complete
    await vi.advanceTimersByTimeAsync(0);

    expect(updateTaskLastRun).toHaveBeenCalledWith('task-1', now.getTime());
    expect(runner).toHaveBeenCalledWith('test-group', '[SCHEDULED TASK]\n\nDo something');

    scheduler.stop();
    vi.useRealTimers();
  });

  it('does not re-execute task that already ran this minute', async () => {
    vi.useFakeTimers();
    const now = new Date(2024, 0, 1, 9, 0);
    vi.setSystemTime(now);

    const runner = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);

    const mockTask = {
      id: 'task-2',
      groupId: 'test-group',
      schedule: '0 9 * * *',
      prompt: 'Do something',
      enabled: true,
      lastRun: now.getTime(), // already ran this minute
      createdAt: Date.now(),
    };

    vi.mocked(getEnabledTasks).mockResolvedValue([mockTask]);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(runner).not.toHaveBeenCalled();

    scheduler.stop();
    vi.useRealTimers();
  });

  it('handles runner errors gracefully', async () => {
    vi.useFakeTimers();
    const now = new Date(2024, 0, 1, 9, 0);
    vi.setSystemTime(now);

    const runner = vi.fn().mockRejectedValue(new Error('runner failed'));
    const scheduler = new TaskScheduler(runner);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockTask = {
      id: 'task-3',
      groupId: 'test-group',
      schedule: '0 9 * * *',
      prompt: 'Do something',
      enabled: true,
      lastRun: null,
      createdAt: Date.now(),
    };

    vi.mocked(getEnabledTasks).mockResolvedValue([mockTask]);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    // Runner was called (error handled internally)
    expect(runner).toHaveBeenCalled();

    scheduler.stop();
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it('handles getEnabledTasks failure gracefully', async () => {
    vi.useFakeTimers();
    const runner = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(getEnabledTasks).mockRejectedValue(new Error('db error'));

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    // Should not crash — error is caught
    expect(runner).not.toHaveBeenCalled();

    scheduler.stop();
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it('does not fire tasks whose cron does not match', async () => {
    vi.useFakeTimers();
    const now = new Date(2024, 0, 1, 10, 0); // 10:00
    vi.setSystemTime(now);

    const runner = vi.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);

    const mockTask = {
      id: 'task-4',
      groupId: 'test-group',
      schedule: '0 9 * * *', // 9:00 — does not match 10:00
      prompt: 'Morning task',
      enabled: true,
      lastRun: null,
      createdAt: Date.now(),
    };

    vi.mocked(getEnabledTasks).mockResolvedValue([mockTask]);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(runner).not.toHaveBeenCalled();

    scheduler.stop();
    vi.useRealTimers();
  });
});
