'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function applyTheme(pref: ThemePreference) {
  if (pref === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', pref);
}

/**
 * Injected into <head> and run before hydration so the page never paints the wrong theme
 * for a frame — CSS alone can't read localStorage, so this is the one thing that has to run
 * as a blocking inline script rather than from a React effect.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>('system');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') setThemeState(stored);
  }, []);

  const setTheme = useCallback((pref: ThemePreference) => {
    setThemeState(pref);
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
    applyTheme(pref);
  }, []);

  return { theme, setTheme };
}
