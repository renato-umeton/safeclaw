// ---------------------------------------------------------------------------
// Mock for virtual:pwa-register (vite-plugin-pwa virtual module)
// ---------------------------------------------------------------------------

export interface RegisterSWOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
}

export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  if (options?.onRegisteredSW) {
    options.onRegisteredSW('', undefined);
  }
  return async (_reloadPage?: boolean) => {};
}
