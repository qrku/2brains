'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfileStore } from '@/entities/profile';
import { useModulesStore, ALL_MODULES } from '@/entities/module';
import { useWorkspaceStore } from '@/entities/workspace';
import { Icon } from '@/shared/ui/Icon';

function BrainIcon() {
  return (
    <svg width="18" height="13" viewBox="0 0 18 13" fill="none" aria-hidden="true">
      <rect x="0"    y="0" width="7.5" height="13" rx="3" fill="#111" />
      <rect x="10.5" y="0" width="7.5" height="13" rx="3" fill="#111" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { state: profileState } = useProfileStore();
  const { state: modulesState } = useModulesStore();
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

  const isProfile  = pathname.startsWith('/profile');
  const isSpace    = pathname.startsWith('/space');
  const isBoard    = pathname.startsWith('/board');
  const isCalendar = pathname.startsWith('/calendar');

  const enabledModules = ALL_MODULES.filter((m) => modulesState.enabled.includes(m.id));
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
                  onClick={() => { wsDispatch({ type: 'SELECT', id: w.id }); setWsOpen(false); }}
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
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  onBlur={submitAdd}
                />
              ) : (
                <button className="nav-workspace-item nav-workspace-add" onClick={() => setAdding(true)}>
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

        {enabledModules.map((mod) => (
          <Link
            key={mod.id}
            href={mod.href}
            className={`nav-link${pathname.startsWith(mod.href) ? ' active' : ''}`}
          >
            {mod.label}
          </Link>
        ))}

        <div style={{ flex: 1 }} />

        <Link href="/profile" className={`nav-profile${isProfile ? ' active' : ''}`}>
          <span className="nav-profile-avatar">{profile.avatar || '🦊'}</span>
          <span className="nav-profile-name">{profile.nickname || 'Профиль'}</span>
        </Link>

      </div>
    </nav>
  );
}
