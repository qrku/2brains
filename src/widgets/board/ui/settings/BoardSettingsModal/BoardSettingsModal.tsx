import type { BoardSettings } from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../../../model/dragging/usePointerTracker';
import { cx } from '@/shared/lib/cx';
import styles from './BoardSettingsModal.module.css';

interface Props {
  settings: BoardSettings;
  onChange: (patch: Partial<BoardSettings>) => void;
  onClose: () => void;
  uiProps: PointerTracker['uiProps'];
}
// Test deploy
export function BoardSettingsModal({ settings, onChange, onClose, uiProps }: Props) {
  return (
    <div
      className={styles['board-settings-overlay']}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className={styles['board-settings-modal']} {...uiProps}>
        <div className={styles['bsm-header']}>
          <span className={styles['bsm-title']}>Настройки доски</span>
          <button className={styles['bsm-close']} onClick={onClose}>
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className={styles['bsm-group']}>
          <div className={styles['bsm-row']}>
            <span className={styles['bsm-label']}>Автопрокрутка у краёв</span>
            <label className={styles['bsm-toggle']}>
              <input
                type="checkbox"
                checked={settings.edgePan}
                onChange={(e) => onChange({ edgePan: e.target.checked })}
              />
              <span className={styles['bsm-track']}>
                <span className={styles['bsm-thumb']} />
              </span>
            </label>
          </div>

          <div className={cx(styles['bsm-sliders'], !settings.edgePan && styles.off)}>
            <div className={styles['bsm-row']}>
              <span className={styles['bsm-label']}>Зона у края</span>
              <span className={styles['bsm-val']}>{settings.edgePanThreshold}px</span>
            </div>
            <input
              type="range"
              className={styles['bsm-slider']}
              min={20}
              max={200}
              step={10}
              value={settings.edgePanThreshold}
              disabled={!settings.edgePan}
              onChange={(e) => onChange({ edgePanThreshold: +e.target.value })}
            />

            <div className={styles['bsm-row']} style={{ marginTop: 14 }}>
              <span className={styles['bsm-label']}>Скорость</span>
              <span className={styles['bsm-val']}>{settings.edgePanSpeed}</span>
            </div>
            <input
              type="range"
              className={styles['bsm-slider']}
              min={1}
              max={20}
              step={1}
              value={settings.edgePanSpeed}
              disabled={!settings.edgePan}
              onChange={(e) => onChange({ edgePanSpeed: +e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
