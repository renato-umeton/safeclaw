// ---------------------------------------------------------------------------
// SafeClaw — PWA Update Notification Hook (with auto-update countdown)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** Seconds before the PWA auto-reloads after detecting a new version. */
export const AUTO_UPDATE_DELAY = 5;

interface PwaUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
  /** Seconds remaining before auto-reload, or null when inactive. */
  countdown: number | null;
  updateServiceWorker: () => Promise<void>;
  dismissUpdate: () => void;
}

export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const doUpdate = useCallback(async () => {
    clearTimer();
    setCountdown(null);
    if (updateSWRef.current) {
      await updateSWRef.current(true);
    }
  }, [clearTimer]);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
        setCountdown(AUTO_UPDATE_DELAY);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
    updateSWRef.current = updateSW;
  }, []);

  // Countdown timer — ticks every second after onNeedRefresh fires
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      doUpdate();
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => {
      clearTimer();
    };
  }, [countdown, doUpdate, clearTimer]);

  const updateServiceWorker = useCallback(async () => {
    await doUpdate();
  }, [doUpdate]);

  const dismissUpdate = useCallback(() => {
    clearTimer();
    setCountdown(null);
    setNeedRefresh(false);
    setOfflineReady(false);
  }, [clearTimer]);

  return { needRefresh, offlineReady, countdown, updateServiceWorker, dismissUpdate };
}
