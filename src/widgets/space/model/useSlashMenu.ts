'use client';

import { useEffect, useRef, useState } from 'react';
import { filterCmds } from './slash/consts';
import type { Cmd, SlashState } from './slash/types';

/** Стейт и клавиатурная навигация меню «/»-команд — общие для MD и визуального режимов. */
export function useSlashMenu() {
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIdx, setSlashIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredCmds = slash ? filterCmds(slash.query) : [];

  /* Меню прокручивается само: без этого стрелки упирались в последний видимый
   * пункт. Скроллим контейнер вручную, а не через scrollIntoView — иначе вместе
   * с меню уезжает и сам редактор. */
  useEffect(() => {
    const menu = menuRef.current;
    const item = menu?.querySelector<HTMLElement>('.slash-item.active');
    if (!menu || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < menu.scrollTop) menu.scrollTop = top - 6;
    else if (bottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = bottom - menu.clientHeight + 6;
    }
  }, [slashIdx, slash]);

  const slashKeyHandler = (
    key: string,
    preventDefault: () => void,
    onSelect: (cmd: Cmd) => void,
  ): boolean => {
    if (!slash || filteredCmds.length === 0) return false;
    if (key === 'ArrowDown') {
      preventDefault();
      setSlashIdx((i) => (i + 1) % filteredCmds.length);
      return true;
    }
    if (key === 'ArrowUp') {
      preventDefault();
      setSlashIdx((i) => (i - 1 + filteredCmds.length) % filteredCmds.length);
      return true;
    }
    if (key === 'Enter') {
      preventDefault();
      onSelect(filteredCmds[slashIdx]);
      return true;
    }
    if (key === 'Escape') {
      preventDefault();
      setSlash(null);
      return true;
    }
    return false;
  };

  return { slash, setSlash, slashIdx, setSlashIdx, menuRef, filteredCmds, slashKeyHandler };
}
