// ---------------------------------------------------------------------------
// SafeClaw — PWA Install Prompt Hook
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'chromium' | 'ios' | null;

interface PwaInstallState {
  canInstall: boolean;
  platform: Platform;
  promptInstall: () => Promise<string | undefined>;
  dismiss: () => void;
}

function detectIos(): boolean {
  const isIosUA = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  // On iOS Safari, navigator.standalone exists but is false when not installed.
  // When it's true, the app is already running as PWA.
  return isIosUA && isStandalone !== true;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>(() => {
    if (detectIos()) return 'ios';
    return null;
  });
  const [canInstall, setCanInstall] = useState<boolean>(() => detectIos());

  useEffect(() => {
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform('chromium');
      setCanInstall(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<string | undefined> => {
    if (!deferredPrompt) return undefined;
    const result = await deferredPrompt.prompt();
    setDeferredPrompt(null);
    setCanInstall(false);
    return result.outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setCanInstall(false);
  }, []);

  return { canInstall, platform, promptInstall, dismiss };
}
