import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../../../model/dragging/usePointerTracker';
import type { Tool } from '../../../model/types';
import { TOOLS } from '../../config';
import { cx } from '@/shared/lib/cx';
import styles from './BoardToolbar.module.css';

interface Props {
  tool: Tool;
  onSelect: (tool: Tool) => void;
  uiProps: PointerTracker['uiProps'];
}

export function BoardToolbar({ tool, onSelect, uiProps }: Props) {
  return (
    <div className={styles['board-panel']} {...uiProps}>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={cx(styles['board-panel-btn'], tool === t.id && styles.active)}
          onClick={() => onSelect(t.id)}
          title={t.label}
        >
          <span className={styles['board-panel-icon']}>
            <Icon name={t.icon} size={18} />
          </span>
          <span className={styles['board-panel-label']}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
