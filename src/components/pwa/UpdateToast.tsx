// ---------------------------------------------------------------------------
// SafeClaw — PWA Update Toast (with auto-update countdown)
// ---------------------------------------------------------------------------

import { RefreshCw, Wifi, X } from 'lucide-react';
import { usePwaUpdate } from '../../hooks/use-pwa-update.js';

export function UpdateToast() {
  const { needRefresh, offlineReady, countdown, updateServiceWorker, dismissUpdate } = usePwaUpdate();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="toast toast-end toast-bottom z-50">
      <div className="alert alert-info shadow-lg">
        {needRefresh ? (
          <>
            <RefreshCw className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-semibold">New version available</span>
              {countdown !== null && (
                <span className="block text-xs opacity-70">
                  Auto-updating in {countdown}s — your settings will be preserved
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button
                className="btn btn-sm btn-primary"
                onClick={updateServiceWorker}
                aria-label="Reload now"
              >
                Reload now
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={dismissUpdate}
                aria-label="Dismiss update notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <Wifi className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <span className="text-sm">Ready to work offline</span>
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={dismissUpdate}
              aria-label="Dismiss offline notification"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
