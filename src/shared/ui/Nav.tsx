'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfileStore } from '@/app/providers/ProfileStoreProvider';
import { useModulesStore } from '@/app/providers/ModulesStoreProvider';
import { ALL_MODULES } from '@/entities/module';
import { ModulePickerModal } from '@/features/module-picker';

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
  const [modulesOpen, setModulesOpen] = useState(false);

  // Landing page has its own header
  if (pathname === '/') return null;

  const { profile } = profileState;

  const isProfile = pathname.startsWith('/profile');
  const isSpace   = pathname.startsWith('/space');
  const isBoard   = pathname.startsWith('/board');

  const enabledModules = ALL_MODULES.filter((m) => modulesState.enabled.includes(m.id));

  return (
    <>
      <nav className="top-nav">
        <div className="nav-inner">

          <Link href="/" className="nav-logo">
            <BrainIcon />
            <span className="nav-logo-text">2brain</span>
          </Link>

          <div className="nav-divider" />

          <Link href="/space" className={`nav-link${isSpace ? ' active' : ''}`}>
            Пространство
          </Link>
          <Link href="/board" className={`nav-link${isBoard ? ' active' : ''}`}>
            Доска
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

          <button className="nav-add" onClick={() => setModulesOpen(true)} title="Модули">
            +
          </button>

          <Link href="/profile" className={`nav-profile${isProfile ? ' active' : ''}`}>
            <span className="nav-profile-avatar">{profile.avatar || '🦊'}</span>
            <span className="nav-profile-name">{profile.nickname || 'Профиль'}</span>
          </Link>

        </div>
      </nav>

      <ModulePickerModal open={modulesOpen} onClose={() => setModulesOpen(false)} />
    </>
  );
}
