// Theme store tests
// The module has side effects that call window.matchMedia at load time.
// We need to intercept addEventListener before the module loads.

let changeHandler: (() => void) | null = null;
let useThemeStore: any;

// Store original matchMedia and override it before dynamic import
const origMatchMedia = window.matchMedia.bind(window);
const mockMatchMedia = vi.fn((query: string) => {
  const mql = origMatchMedia(query);
  // Patch addEventListener to capture the change handler
  const origAdd = mql.addEventListener.bind(mql);
  mql.addEventListener = ((event: string, handler: any, ...args: any[]) => {
    if (event === 'change') changeHandler = handler;
    return origAdd(event, handler, ...args);
  }) as any;
  return mql;
});

// Replace window.matchMedia using the setter (happy-dom uses get/set descriptors)
(window as any).matchMedia = mockMatchMedia;

beforeAll(async () => {
  const mod = await import('../../src/stores/theme-store');
  useThemeStore = mod.useThemeStore;
});

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ theme: 'system', resolved: 'light' });
  });

  it('has default state', () => {
    const state = useThemeStore.getState();
    expect(state.theme).toBeDefined();
    expect(state.resolved).toBeDefined();
    expect(['light', 'dark']).toContain(state.resolved);
  });

  it('setTheme updates theme and resolved', () => {
    useThemeStore.getState().setTheme('dark');
    const state = useThemeStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.resolved).toBe('dark');
  });

  it('persists theme to localStorage', () => {
    useThemeStore.getState().setTheme('light');
    expect(localStorage.getItem('obc-theme')).toBe('light');
  });

  it('resolves system theme to dark when system prefers dark', () => {
    // Temporarily mock to return dark preference
    mockMatchMedia.mockImplementation((query: string) => {
      const mql = origMatchMedia(query);
      Object.defineProperty(mql, 'matches', { value: true, writable: true });
      return mql;
    });

    useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().theme).toBe('system');
    expect(useThemeStore.getState().resolved).toBe('dark');

    // Restore
    mockMatchMedia.mockImplementation((query: string) => origMatchMedia(query));
  });

  it('applies theme to document', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('system media query change handler updates resolved when theme is system', () => {
    expect(changeHandler).toBeTruthy();

    useThemeStore.setState({ theme: 'system', resolved: 'light' });

    // Mock to return dark preference for getSystemTheme()
    mockMatchMedia.mockImplementation((query: string) => {
      const mql = origMatchMedia(query);
      Object.defineProperty(mql, 'matches', { value: true, writable: true });
      return mql;
    });

    changeHandler!();

    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Restore
    mockMatchMedia.mockImplementation((query: string) => origMatchMedia(query));
  });

  it('system media query change handler does not update when theme is explicit', () => {
    expect(changeHandler).toBeTruthy();

    useThemeStore.setState({ theme: 'light', resolved: 'light' });

    // Mock to return dark preference
    mockMatchMedia.mockImplementation((query: string) => {
      const mql = origMatchMedia(query);
      Object.defineProperty(mql, 'matches', { value: true, writable: true });
      return mql;
    });

    changeHandler!();

    // Should NOT change since theme is 'light', not 'system'
    expect(useThemeStore.getState().resolved).toBe('light');

    // Restore
    mockMatchMedia.mockImplementation((query: string) => origMatchMedia(query));
  });
});
