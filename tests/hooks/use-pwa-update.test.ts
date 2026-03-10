// ---------------------------------------------------------------------------
// usePwaUpdate hook tests
// ---------------------------------------------------------------------------

import { renderHook, act } from '@testing-library/react';

// Mock virtual:pwa-register module
const mockUpdateSW = vi.fn().mockResolvedValue(undefined);
let capturedOnNeedRefresh: ((value: boolean) => void) | null = null;
let capturedOnOfflineReady: (() => void) | null = null;
let capturedOnRegisteredSW: ((swUrl: string, registration: ServiceWorkerRegistration | undefined) => void) | null = null;

vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts: {
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  }) => {
    // Capture callbacks for test control
    if (opts.onNeedRefresh) {
      capturedOnNeedRefresh = opts.onNeedRefresh as unknown as (value: boolean) => void;
    }
    if (opts.onOfflineReady) {
      capturedOnOfflineReady = opts.onOfflineReady;
    }
    if (opts.onRegisteredSW) {
      capturedOnRegisteredSW = opts.onRegisteredSW as unknown as (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    }
    return mockUpdateSW;
  },
}));

let usePwaUpdate: typeof import('../../src/hooks/use-pwa-update').usePwaUpdate;
let AUTO_UPDATE_DELAY: typeof import('../../src/hooks/use-pwa-update').AUTO_UPDATE_DELAY;

beforeAll(async () => {
  const mod = await import('../../src/hooks/use-pwa-update');
  usePwaUpdate = mod.usePwaUpdate;
  AUTO_UPDATE_DELAY = mod.AUTO_UPDATE_DELAY;
});

describe('usePwaUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUpdateSW.mockClear();
    capturedOnNeedRefresh = null;
    capturedOnOfflineReady = null;
    capturedOnRegisteredSW = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with needRefresh false and offlineReady false', () => {
    const { result } = renderHook(() => usePwaUpdate());
    expect(result.current.needRefresh).toBe(false);
    expect(result.current.offlineReady).toBe(false);
  });

  it('sets needRefresh to true when onNeedRefresh is called', () => {
    const { result } = renderHook(() => usePwaUpdate());

    expect(capturedOnNeedRefresh).toBeTruthy();
    act(() => {
      capturedOnNeedRefresh!(true);
    });

    expect(result.current.needRefresh).toBe(true);
  });

  it('updateServiceWorker calls the registered update function', async () => {
    const { result } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await result.current.updateServiceWorker();
    });

    expect(mockUpdateSW).toHaveBeenCalledWith(true);
  });

  it('dismissUpdate resets needRefresh to false', () => {
    const { result } = renderHook(() => usePwaUpdate());

    act(() => {
      capturedOnNeedRefresh!(true);
    });
    expect(result.current.needRefresh).toBe(true);

    act(() => {
      result.current.dismissUpdate();
    });
    expect(result.current.needRefresh).toBe(false);
  });

  describe('auto-update countdown', () => {
    it('starts countdown at AUTO_UPDATE_DELAY when onNeedRefresh fires', () => {
      const { result } = renderHook(() => usePwaUpdate());

      act(() => {
        capturedOnNeedRefresh!(true);
      });

      expect(result.current.countdown).toBe(AUTO_UPDATE_DELAY);
    });

    it('countdown is null when no update is needed', () => {
      const { result } = renderHook(() => usePwaUpdate());
      expect(result.current.countdown).toBeNull();
    });

    it('decrements countdown every second', () => {
      const { result } = renderHook(() => usePwaUpdate());

      act(() => {
        capturedOnNeedRefresh!(true);
      });
      expect(result.current.countdown).toBe(AUTO_UPDATE_DELAY);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.countdown).toBe(AUTO_UPDATE_DELAY - 1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.countdown).toBe(AUTO_UPDATE_DELAY - 2);
    });

    it('auto-reloads when countdown reaches zero', () => {
      const { result } = renderHook(() => usePwaUpdate());

      act(() => {
        capturedOnNeedRefresh!(true);
      });

      act(() => {
        vi.advanceTimersByTime(AUTO_UPDATE_DELAY * 1000);
      });

      expect(mockUpdateSW).toHaveBeenCalledWith(true);
    });

    it('dismissUpdate cancels the countdown', () => {
      const { result } = renderHook(() => usePwaUpdate());

      act(() => {
        capturedOnNeedRefresh!(true);
      });
      expect(result.current.countdown).toBe(AUTO_UPDATE_DELAY);

      act(() => {
        result.current.dismissUpdate();
      });

      expect(result.current.countdown).toBeNull();
      expect(result.current.needRefresh).toBe(false);

      // Advancing time should NOT trigger update
      act(() => {
        vi.advanceTimersByTime(AUTO_UPDATE_DELAY * 1000);
      });
      expect(mockUpdateSW).not.toHaveBeenCalled();
    });

    it('manual updateServiceWorker clears countdown', async () => {
      const { result } = renderHook(() => usePwaUpdate());

      act(() => {
        capturedOnNeedRefresh!(true);
      });

      await act(async () => {
        await result.current.updateServiceWorker();
      });

      expect(result.current.countdown).toBeNull();
      expect(mockUpdateSW).toHaveBeenCalledTimes(1);
    });
  });
});
