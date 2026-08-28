'use client';

import { useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { PasteMode } from '../../../model/types';
import type { PointerTracker } from '../../../model/dragging/usePointerTracker';
import styles from './PasteModePopup.module.css';

interface Props {
  /** Экранные координаты точки вставки — попап встаёт рядом с ней. */
  x: number;
  y: number;
  /** Сколько блоков вставляется — по нему выбирается форма слова в подписи. */
  count: number;
  onPick: (mode: PasteMode) => void;
  onClose: () => void;
  uiProps: PointerTracker['uiProps'];
}

/**
 * Выбор режима вставки содержимого, скопированного с другой доски.
 *
 * Показывается только при переносе между досками: внутри одной доски связывать нечего, и
 * лишний вопрос там только мешал бы обычному копированию.
 */
export function PasteModePopup({ x, y, count, onPick, onClose, uiProps }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className={styles['paste-popup']} style={{ left: x, top: y }} {...uiProps}>
      <div className={styles['paste-popup-title']}>
        {count === 1 ? 'Блок с другой доски' : `Блоки с другой доски: ${count}`}
      </div>

      <button className={styles['paste-popup-option']} onClick={() => onPick('duplicate')}>
        <span className={styles['paste-popup-icon']}>
          <Icon name="copy-1" size={13} />
        </span>
        <span>
          <span className={styles['paste-popup-label']}>Дубликат</span>
          <span className={styles['paste-popup-hint']}>
            Свои файлы в папке этой доски, с копией текста. С оригиналом не связаны.
          </span>
        </span>
      </button>

      <button className={styles['paste-popup-option']} onClick={() => onPick('link')}>
        <span className={styles['paste-popup-icon']}>
          <Icon name="link-1" size={13} />
        </span>
        <span>
          <span className={styles['paste-popup-label']}>Связать</span>
          <span className={styles['paste-popup-hint']}>
            Показывают файлы оригинала, только для чтения. Правка — на исходной доске.
          </span>
        </span>
      </button>
    </div>
  );
}
