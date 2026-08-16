'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfileStore } from '@/entities/profile';
import { useWorkspaceStore } from '@/entities/workspace';
import { Icon } from '@/shared/ui/Icon';
import { useTheme, type ThemePreference } from '@/shared/lib/theme';

function BrainIcon() {
  return (
    <svg width="18" height="13" viewBox="0 0 18 13" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="7.5" height="13" rx="3" fill="var(--ink)" />
      <rect x="10.5" y="0" width="7.5" height="13" rx="3" fill="var(--ink)" />
    </svg>
  );
}

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'Тема: как в системе',
  light: 'Тема: светлая',
  dark: 'Тема: тёмная',
};

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === 'light') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 21h8M12 17.5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      className="nav-theme-toggle"
      title={THEME_LABEL[theme]}
      aria-label={THEME_LABEL[theme]}
      onClick={() => {
        const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
        setTheme(next);
      }}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { state: profileState } = useProfileStore();
  const { state: wsState, dispatch: wsDispatch } = useWorkspaceStore();

  const [wsOpen, setWsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const wsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) {
        setWsOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [wsOpen]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // Landing page has its own header
  if (pathname === '/') return null;

  const { profile } = profileState;

  const isProfile = pathname.startsWith('/profile');
  const isSpace = pathname.startsWith('/space');
  const isBoard = pathname.startsWith('/board');
  const isCalendar = pathname.startsWith('/calendar');

  const currentWorkspace = wsState.workspaces.find((w) => w.id === wsState.currentId);

  function submitAdd() {
    const name = newName.trim();
    if (name) wsDispatch({ type: 'ADD', name });
    setNewName('');
    setAdding(false);
    setWsOpen(false);
  }

  return (
    <nav className="top-nav">
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <BrainIcon />
          <span className="nav-logo-text">2brain</span>
        </Link>

        <div className="nav-divider" />

        <div className="nav-workspace" ref={wsRef}>
          <button
            className={`nav-link nav-workspace-trigger${wsOpen ? ' active' : ''}`}
            onClick={() => setWsOpen((v) => !v)}
          >
            {currentWorkspace?.name ?? 'Personal'}
            <Icon name="arrow-down-simple" size={10} />
          </button>

          {wsOpen && (
            <div className="nav-workspace-menu">
              {wsState.workspaces.map((w) => (
                <button
                  key={w.id}
                  className={`nav-workspace-item${w.id === wsState.currentId ? ' active' : ''}`}
                  onClick={() => {
                    wsDispatch({ type: 'SELECT', id: w.id });
                    setWsOpen(false);
                  }}
                >
                  {w.name}
                </button>
              ))}

              <div className="nav-workspace-divider" />

              {adding ? (
                <input
                  ref={inputRef}
                  className="nav-workspace-input"
                  value={newName}
                  placeholder="Название workspace"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitAdd();
                    if (e.key === 'Escape') {
                      setAdding(false);
                      setNewName('');
                    }
                  }}
                  onBlur={submitAdd}
                />
              ) : (
                <button
                  className="nav-workspace-item nav-workspace-add"
                  onClick={() => setAdding(true)}
                >
                  <Icon name="add" size={11} />
                  Добавить workspace
                </button>
              )}
            </div>
          )}
        </div>

        <div className="nav-divider" />

        <Link href="/space" className={`nav-link${isSpace ? ' active' : ''}`}>
          Пространство
        </Link>
        <Link href="/board" className={`nav-link${isBoard ? ' active' : ''}`}>
          Доска
        </Link>
        <Link href="/calendar" className={`nav-link${isCalendar ? ' active' : ''}`}>
          Календарь
        </Link>

        <div style={{ flex: 1 }} />

        <ThemeToggle />

        <Link href="/profile" className={`nav-profile${isProfile ? ' active' : ''}`}>
          <span className="nav-profile-avatar">{profile.avatar || '🦊'}</span>
          <span className="nav-profile-name">{profile.nickname || 'Профиль'}</span>
        </Link>
      </div>
    </nav>
  );
}
