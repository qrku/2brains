import type { BoardSettings } from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../model/usePointerTracker';

interface Props {
  settings: BoardSettings;
  onChange: (patch: Partial<BoardSettings>) => void;
  onClose: () => void;
  uiProps: PointerTracker['uiProps'];
}

export function BoardSettingsModal({ settings, onChange, onClose, uiProps }: Props) {
  return (
    <div
      className="board-settings-overlay"
      onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div className="board-settings-modal" {...uiProps}>
        <div className="bsm-header">
          <span className="bsm-title">Настройки доски</span>
          <button className="bsm-close" onClick={onClose}><Icon name="close" size={13} /></button>
        </div>

        <div className="bsm-group">
          <div className="bsm-row">
            <span className="bsm-label">Автопрокрутка у краёв</span>
            <label className="bsm-toggle">
              <input
                type="checkbox"
                checked={settings.edgePan}
                onChange={(e) => onChange({ edgePan: e.target.checked })}
              />
              <span className="bsm-track"><span className="bsm-thumb" /></span>
            </label>
          </div>

          <div className={`bsm-sliders${settings.edgePan ? '' : ' off'}`}>
            <div className="bsm-row">
              <span className="bsm-label">Зона у края</span>
              <span className="bsm-val">{settings.edgePanThreshold}px</span>
            </div>
            <input
              type="range" className="bsm-slider" min={20} max={200} step={10}
              value={settings.edgePanThreshold} disabled={!settings.edgePan}
              onChange={(e) => onChange({ edgePanThreshold: +e.target.value })}
            />

            <div className="bsm-row" style={{ marginTop: 14 }}>
              <span className="bsm-label">Скорость</span>
              <span className="bsm-val">{settings.edgePanSpeed}</span>
            </div>
            <input
              type="range" className="bsm-slider" min={1} max={20} step={1}
              value={settings.edgePanSpeed} disabled={!settings.edgePan}
              onChange={(e) => onChange({ edgePanSpeed: +e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
