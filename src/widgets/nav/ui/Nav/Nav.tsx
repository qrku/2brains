'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfileStore } from '@/entities/profile';
import { useWorkspaceStore } from '@/entities/workspace';
import { Icon } from '@/shared/ui/Icon';
import { useTheme, type ThemePreference } from '@/shared/lib/theme';
import { cx } from '@/shared/lib/cx';
import styles from './Nav.module.css';

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
      className={styles['nav-theme-toggle']}
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

/** Разделы приложения — один список на встроенные ссылки и на мобильное меню. */
const SECTIONS = [
  { href: '/space', label: 'Пространство' },
  { href: '/board', label: 'Доска' },
  { href: '/calendar', label: 'Календарь' },
] as const;

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {open ? (
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { state: profileState } = useProfileStore();
  const { state: wsState, dispatch: wsDispatch } = useWorkspaceStore();

  const [wsOpen, setWsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  // Мобильное меню: на широком экране разметка скрывает его целиком, поэтому
  // состояние можно держать всегда, не завися от текущей ширины окна.
  const [menuOpen, setMenuOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wsOpen) return;
    const onClick = (e: PointerEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) {
        setWsOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener('pointerdown', onClick);
    return () => document.removeEventListener('pointerdown', onClick);
  }, [wsOpen]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // Переход по ссылке меню не размонтирует навигацию — закрываем его сами.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Landing page has its own header
  if (pathname === '/') return null;

  const { profile } = profileState;

  const isProfile = pathname.startsWith('/profile');

  const currentWorkspace = wsState.workspaces.find((w) => w.id === wsState.currentId);

  function submitAdd() {
    const name = newName.trim();
    if (name) wsDispatch({ type: 'ADD', name });
    setNewName('');
    setAdding(false);
    setWsOpen(false);
  }

  return (
    <nav className={styles['top-nav']}>
      <div className={styles['nav-inner']}>
        <Link href="/" className={styles['nav-logo']}>
          <BrainIcon />
          <span className={styles['nav-logo-text']}>2brains</span>
        </Link>

        <div className={styles['nav-divider']} />

        <div className={styles['nav-workspace']} ref={wsRef}>
          <button
            className={cx(
              styles['nav-link'],
              styles['nav-workspace-trigger'],
              wsOpen && styles.active,
            )}
            onClick={() => setWsOpen((v) => !v)}
          >
            {currentWorkspace?.name ?? 'Personal'}
            <Icon name="arrow-down-simple" size={10} />
          </button>

          {wsOpen && (
            <div className={styles['nav-workspace-menu']}>
              {wsState.workspaces.map((w) => (
                <button
                  key={w.id}
                  className={cx(
                    styles['nav-workspace-item'],
                    w.id === wsState.currentId && styles.active,
                  )}
                  onClick={() => {
                    wsDispatch({ type: 'SELECT', id: w.id });
                    setWsOpen(false);
                  }}
                >
                  {w.name}
                </button>
              ))}

              <div className={styles['nav-workspace-divider']} />

              {adding ? (
                <input
                  ref={inputRef}
                  className={styles['nav-workspace-input']}
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
                  className={cx(styles['nav-workspace-item'], styles['nav-workspace-add'])}
                  onClick={() => setAdding(true)}
                >
                  <Icon name="add" size={11} />
                  Добавить workspace
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles['nav-divider']} />

        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={cx(styles['nav-link'], pathname.startsWith(s.href) && styles.active)}
          >
            {s.label}
          </Link>
        ))}

        <div className={styles['nav-spacer']} />

        <ThemeToggle />

        <Link href="/profile" className={cx(styles['nav-profile'], isProfile && styles.active)}>
          <span className={styles['nav-profile-avatar']}>{profile.avatar || '🦊'}</span>
          <span className={styles['nav-profile-name']}>{profile.nickname || 'Профиль'}</span>
        </Link>

        <button
          type="button"
          className={styles['nav-burger']}
          aria-label={menuOpen ? 'Закрыть меню' : 'Меню'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <BurgerIcon open={menuOpen} />
        </button>
      </div>

      {/* Мобильное меню: то же, что на широком экране не помещается в одну строку.
          Скрыто разметкой выше 720 px, поэтому рендерится без проверки ширины. */}
      {menuOpen && (
        <>
          <div className={styles['nav-menu-backdrop']} onClick={() => setMenuOpen(false)} />
          <div className={styles['nav-menu']}>
            <div className={styles['nav-menu-label']}>Workspace</div>
            {wsState.workspaces.map((w) => (
              <button
                key={w.id}
                className={cx(styles['nav-menu-item'], w.id === wsState.currentId && styles.active)}
                onClick={() => {
                  wsDispatch({ type: 'SELECT', id: w.id });
                  setMenuOpen(false);
                }}
              >
                {w.name}
              </button>
            ))}

            {/* Выпадающий список workspace на узком экране скрыт целиком, поэтому
                создание переезжает сюда — иначе завести workspace с телефона было
                бы нельзя вовсе. */}
            {adding ? (
              <input
                ref={inputRef}
                className={styles['nav-menu-input']}
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
                className={cx(styles['nav-menu-item'], styles['nav-menu-add'])}
                onClick={() => setAdding(true)}
              >
                <Icon name="add" size={12} />
                Добавить workspace
              </button>
            )}

            <div className={styles['nav-menu-divider']} />

            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={cx(
                  styles['nav-menu-item'],
                  pathname.startsWith(s.href) && styles.active,
                )}
              >
                {s.label}
              </Link>
            ))}

            <div className={styles['nav-menu-divider']} />

            <Link
              href="/profile"
              className={cx(styles['nav-menu-item'], isProfile && styles.active)}
            >
              <span className={styles['nav-profile-avatar']}>{profile.avatar || '🦊'}</span>
              {profile.nickname || 'Профиль'}
            </Link>
          </div>
        </>
      )}
    </nav>
  );
}
