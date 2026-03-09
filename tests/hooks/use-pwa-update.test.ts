// ---------------------------------------------------------------------------
// usePwaUpdate hook tests
// ---------------------------------------------------------------------------

import { renderHook, act } from '@testing-library/react';

// Mock virtual:pwa-register module
const mockUpdateSW = vi.fn().mockResolvedValue(undefined);
let capturedOnNeedRefresh: ((value: boolean) => void) | null = null;
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
    if (opts.onRegisteredSW) {
      capturedOnRegisteredSW = opts.onRegisteredSW as unknown as (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    }
    return mockUpdateSW;
  },
}));

let usePwaUpdate: typeof import('../../src/hooks/use-pwa-update').usePwaUpdate;

beforeAll(async () => {
  const mod = await import('../../src/hooks/use-pwa-update');
  usePwaUpdate = mod.usePwaUpdate;
});

describe('usePwaUpdate', () => {
  beforeEach(() => {
    mockUpdateSW.mockClear();
    capturedOnNeedRefresh = null;
    capturedOnRegisteredSW = null;
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
});
