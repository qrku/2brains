import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../../../model/dragging/usePointerTracker';
import { cx } from '@/shared/lib/cx';
import styles from './BoardBottomBar.module.css';

const ZOOM_STEP = 1.25;

interface Props {
  scale: number;
  onZoom: (factor: number) => void;
  onOpenSettings: () => void;
  uiProps: PointerTracker['uiProps'];
}

export function BoardBottomBar({ scale, onZoom, onOpenSettings, uiProps }: Props) {
  return (
    <div className={styles['board-bar']} {...uiProps}>
      <button
        className={cx(styles['board-btn'], styles['board-btn-icon'])}
        onClick={() => onZoom(ZOOM_STEP)}
      >
        <Icon name="add" size={14} />
      </button>
      <span className={styles['board-zoom-pct']}>{Math.round(scale * 100)}%</span>
      <button
        className={cx(styles['board-btn'], styles['board-btn-icon'])}
        onClick={() => onZoom(1 / ZOOM_STEP)}
      >
        <Icon name="remove" size={14} />
      </button>

      <div style={{ flex: 1 }} />

      <button
        className={cx(styles['board-btn'], styles['board-settings-btn'])}
        onClick={onOpenSettings}
        title="Настройки"
      >
        <Icon name="settings-1" size={16} />
      </button>
    </div>
  );
}
