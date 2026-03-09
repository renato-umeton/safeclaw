// ---------------------------------------------------------------------------
// SafeClaw — PWA Install Prompt Hook
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'chromium' | 'ios' | 'unsupported' | null;

interface PwaInstallState {
  canInstall: boolean;
  showBanner: boolean;
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

function isIosStandalone(): boolean {
  const isIosUA = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return isIosUA && isStandalone === true;
}

function isRunningStandalone(): boolean {
  if (isIosStandalone()) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function detectInitialPlatform(): Platform {
  if (detectIos()) return 'ios';
  // Non-iOS, non-standalone: detect if Chromium-based via chrome global or UA
  // Chromium browsers will fire beforeinstallprompt later; for now detect unsupported
  const ua = navigator.userAgent;
  const isChromium = /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua) || /CriOS/.test(ua);
  const isEdgeChromium = /Edg\//.test(ua);
  const isOpera = /OPR\//.test(ua);
  if (isChromium || isEdgeChromium || isOpera) return null; // Chromium-based, will get platform from beforeinstallprompt
  return 'unsupported';
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>(() => detectInitialPlatform());
  const [canInstall, setCanInstall] = useState<boolean>(() => detectIos());
  const [dismissed, setDismissed] = useState(false);

  const standalone = isRunningStandalone();

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
    setDismissed(true);
  }, []);

  const showBanner = !standalone && !dismissed;

  return { canInstall, showBanner, platform, promptInstall, dismiss };
}
