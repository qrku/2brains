'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { SlashMenu } from '../model/useSlashMenu';

/**
 * Rendered into document.body: the node it belongs to lives inside the scaled canvas, which
 * would otherwise shrink and clip this menu along with it.
 */
export function SlashMenuPopup({ menu }: { menu: SlashMenu }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.children[menu.activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [menu.activeIndex]);

  return (
    <div
      className="board-slash-menu"
      style={{ left: menu.x, top: menu.y + 6 }}
      // Keep the node's editor focused — a blur here would tear the menu down mid-click.
      onMouseDown={(e) => e.preventDefault()}
    >
      {menu.query && <div className="bsm-query">/{menu.query}</div>}

      <div ref={listRef} className="bsm-list">
        {menu.files.length === 0 ? (
          <div className="bsm-empty">Файлов не найдено</div>
        ) : menu.files.map((f, i) => (
          <div
            key={f.id}
            className={`bsm-item${i === menu.activeIndex ? ' active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); menu.insert(f); }}
          >
            <span className="bsm-item-icon"><Icon name="file" size={13} /></span>
            <span className="bsm-item-name">{f.name}</span>
          </div>
        ))}
      </div>

      <div className="bsm-hint">↑↓ навигация · Enter выбрать · Esc закрыть</div>
    </div>
  );
}
