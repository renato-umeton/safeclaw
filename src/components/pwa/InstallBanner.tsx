// ---------------------------------------------------------------------------
// SafeClaw — PWA Install Banner
// ---------------------------------------------------------------------------

import { Download, Share, X } from 'lucide-react';
import { usePwaInstall } from '../../hooks/use-pwa-install.js';

export function InstallBanner() {
  const { canInstall, platform, promptInstall, dismiss } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <div className="alert alert-info shadow-lg mx-4 mt-2" role="alert">
      <Download className="w-5 h-5 shrink-0" />
      <div className="flex-1">
        <h3 className="font-bold text-sm">Install SafeClaw</h3>
        {platform === 'ios' ? (
          <p className="text-xs">
            Tap the <Share className="w-3 h-3 inline" /> Share button, then select{' '}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="text-xs">Install as an app for quick access and offline use.</p>
        )}
      </div>
      <div className="flex gap-1">
        {platform === 'chromium' && (
          <button
            className="btn btn-sm btn-primary"
            onClick={promptInstall}
            aria-label="Install"
          >
            Install
          </button>
        )}
        <button
          className="btn btn-sm btn-ghost"
          onClick={dismiss}
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
