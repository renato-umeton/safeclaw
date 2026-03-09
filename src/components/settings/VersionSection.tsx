// ---------------------------------------------------------------------------
// SafeClaw — Version section for settings
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Info, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { APP_VERSION } from '../../config.js';
import { checkLatestVersion } from '../../version-checker.js';
import type { VersionStatus } from '../../version-checker.js';

export function VersionSection() {
  const [status, setStatus] = useState<VersionStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const runCheck = useCallback(async () => {
    setChecking(true);
    const result = await checkLatestVersion(APP_VERSION);
    setStatus(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="card card-bordered bg-base-200">
      <div className="card-body p-4 sm:p-6 gap-3">
        <h3 className="card-title text-base gap-2"><Info className="w-4 h-4" /> Version</h3>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-semibold">v{APP_VERSION}</span>
        </div>

        {checking && (
          <div className="flex items-center gap-2 text-sm opacity-60">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Checking for updates...</span>
          </div>
        )}

        {!checking && status?.isUpToDate === true && (
          <div className="flex items-center gap-2">
            <div className="badge badge-success badge-sm gap-1.5">
              <CheckCircle className="w-3 h-3" />
              You're on the latest version
            </div>
            {status.latestDate && (
              <span className="text-xs opacity-60">
                Released {formatDate(status.latestDate)}
              </span>
            )}
          </div>
        )}

        {!checking && status?.isUpToDate === false && (
          <div className="space-y-1">
            <div className="badge badge-warning badge-sm gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Update available — v{status.latest}
            </div>
            {status.latestDate && (
              <p className="text-xs opacity-60">
                Released {formatDate(status.latestDate)}
              </p>
            )}
            <p className="text-xs opacity-50">
              Reload the page or reinstall the PWA to get the latest version.
            </p>
          </div>
        )}

        {!checking && status?.error && (
          <p className="text-xs text-error opacity-70">
            Could not check for updates: {status.error}
          </p>
        )}

        {!checking && (
          <button
            className="btn btn-ghost btn-xs gap-1 w-fit"
            onClick={runCheck}
            aria-label="Check again"
          >
            <RefreshCw className="w-3 h-3" />
            Check again
          </button>
        )}
      </div>
    </div>
  );
}
