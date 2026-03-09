// ---------------------------------------------------------------------------
// SafeClaw — PWA Update Notification Hook
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface PwaUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: () => Promise<void>;
  dismissUpdate: () => void;
}

export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
    updateSWRef.current = updateSW;
  }, []);

  const updateServiceWorker = useCallback(async () => {
    if (updateSWRef.current) {
      await updateSWRef.current(true);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
    setOfflineReady(false);
  }, []);

  return { needRefresh, offlineReady, updateServiceWorker, dismissUpdate };
}
