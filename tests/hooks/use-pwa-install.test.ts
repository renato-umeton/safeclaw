// ---------------------------------------------------------------------------
// usePwaInstall hook tests
// ---------------------------------------------------------------------------

import { renderHook, act } from '@testing-library/react';

// We need to dynamically import the hook after setting up mocks
let usePwaInstall: typeof import('../../src/hooks/use-pwa-install').usePwaInstall;

beforeAll(async () => {
  const mod = await import('../../src/hooks/use-pwa-install');
  usePwaInstall = mod.usePwaInstall;
});

describe('usePwaInstall', () => {
  let originalUserAgent: string;

  beforeEach(() => {
    originalUserAgent = navigator.userAgent;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
    // Clean up standalone property
    if ('standalone' in navigator) {
      Object.defineProperty(navigator, 'standalone', {
        value: undefined,
        writable: true,
        configurable: true,
      });
    }
  });

  it('starts with canInstall false and no platform', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.platform).toBeNull();
  });

  it('captures beforeinstallprompt event on Chromium browsers', () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockPrompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
      preventDefault: () => void;
    };
    Object.defineProperty(event, 'prompt', { value: mockPrompt });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canInstall).toBe(true);
    expect(result.current.platform).toBe('chromium');
  });

  it('detects iOS Safari when navigator.standalone is undefined and UA matches iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'standalone', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // Need to re-render to re-evaluate iOS detection
    const { result } = renderHook(() => usePwaInstall());

    // iOS detection happens on mount — since standalone is undefined and UA matches iOS
    // But the hook should check navigator.standalone === undefined (not in standalone mode)
    // and the iOS user agent pattern
    expect(result.current.platform).toBe('ios');
    expect(result.current.canInstall).toBe(true);
  });

  it('detects iOS Safari with iPad user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'standalone', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.platform).toBe('ios');
    expect(result.current.canInstall).toBe(true);
  });

  it('does not show install on iOS when already in standalone mode', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePwaInstall());
    // Already installed — should not show install prompt
    expect(result.current.canInstall).toBe(false);
  });

  it('promptInstall calls the deferred prompt on Chromium', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockPrompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
    };
    Object.defineProperty(event, 'prompt', { value: mockPrompt });

    act(() => {
      window.dispatchEvent(event);
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
  });

  it('promptInstall returns undefined when no deferred prompt exists', async () => {
    const { result } = renderHook(() => usePwaInstall());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(outcome).toBeUndefined();
  });

  it('resets canInstall after prompt is used (accepted)', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockPrompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
    };
    Object.defineProperty(event, 'prompt', { value: mockPrompt });

    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(result.current.canInstall).toBe(false);
  });

  it('dismiss sets canInstall to false', () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockPrompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
    };
    Object.defineProperty(event, 'prompt', { value: mockPrompt });

    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.canInstall).toBe(false);
  });

  it('cleans up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => usePwaInstall());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    removeSpy.mockRestore();
  });
});
