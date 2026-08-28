'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { SlashMenu } from '../../../model/slashMenu/useSlashMenu';
import { cx } from '@/shared/lib/cx';
import styles from './SlashMenuPopup.module.css';

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
      className={styles['board-slash-menu']}
      style={{ left: menu.x, top: menu.y + 6 }}
      // Держит фокус в редакторе ноды: blur снёс бы меню прямо под нажатием.
      // pointerdown, а не mousedown — на касании второго браузер не присылает,
      // и меню закрывалось бы раньше, чем срабатывал выбор файла.
      onPointerDown={(e) => e.preventDefault()}
    >
      {menu.query && <div className={styles['bsm-query']}>/{menu.query}</div>}

      <div ref={listRef} className={styles['bsm-list']}>
        {menu.files.length === 0 ? (
          <div className={styles['bsm-empty']}>Файлов не найдено</div>
        ) : (
          menu.files.map((f, i) => (
            <div
              key={f.id}
              className={cx(styles['bsm-item'], i === menu.activeIndex && styles.active)}
              onPointerDown={(e) => {
                e.preventDefault();
                menu.insert(f);
              }}
            >
              <span className={styles['bsm-item-icon']}>
                <Icon name="file" size={13} />
              </span>
              <span className={styles['bsm-item-name']}>{f.name}</span>
            </div>
          ))
        )}
      </div>

      <div className={styles['bsm-hint']}>↑↓ навигация · Enter выбрать · Esc закрыть</div>
    </div>
  );
}
