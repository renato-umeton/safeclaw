// ---------------------------------------------------------------------------
// SafeClaw — Layout shell
// ---------------------------------------------------------------------------

import { Outlet, NavLink } from 'react-router';
import { MessageSquare, FolderOpen, Clock, Settings, Lightbulb, Puzzle } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.js';
import { FileViewerModal } from '../files/FileViewerModal.js';
import { InstallBanner } from '../pwa/InstallBanner.js';
import { UpdateToast } from '../pwa/UpdateToast.js';
import { useFileViewerStore } from '../../stores/file-viewer-store.js';
import { APP_VERSION } from '../../config.js';

const navItems = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/tasks', label: 'Tasks', icon: Clock },
  { to: '/use-cases', label: 'Use Cases', icon: Lightbulb },
  { to: '/skill-hub', label: 'Skills', icon: Puzzle },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Layout() {
  const viewerFile = useFileViewerStore((s) => s.file);
  const closeFile = useFileViewerStore((s) => s.closeFile);

  return (
    <div className="flex flex-col h-screen h-[100dvh]">
      {/* ---- Top navbar ---- */}
      <div className="navbar bg-base-200 border-b border-base-300 safe-area-top px-4 min-h-14">
        <div className="navbar-start">
          <span className="text-xl font-bold select-none flex items-center gap-1.5">
            <img src="/favicon.svg" alt="SafeClaw" className="w-7 h-7 rounded-full" />
            <span className="hidden sm:inline">SafeClaw</span>
            <span className="hidden sm:inline text-xs font-normal opacity-60">v{APP_VERSION}</span>
          </span>
        </div>

        {/* Desktop tabs */}
        <div className="navbar-center hidden sm:flex">
          <div role="tablist" className="tabs tabs-box">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                role="tab"
                className={({ isActive }) =>
                  `tab gap-1.5 ${isActive ? 'tab-active' : ''}`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="navbar-end">
          <ThemeToggle />
        </div>
      </div>

      {/* ---- PWA install banner ---- */}
      <InstallBanner />

      {/* ---- Page content ---- */}
      <main className="flex-1 overflow-hidden pb-16 sm:pb-0">
        <Outlet />
      </main>

      {/* ---- Mobile bottom nav ---- */}
      <div className="dock sm:hidden">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? 'dock-active' : '')}
          >
            <Icon className="w-5 h-5" />
            <span className="dock-label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* ---- PWA update toast ---- */}
      <UpdateToast />

      {/* ---- Global file viewer modal ---- */}
      {viewerFile && (
        <FileViewerModal
          name={viewerFile.name}
          content={viewerFile.content}
          onClose={closeFile}
        />
      )}
    </div>
  );
}
