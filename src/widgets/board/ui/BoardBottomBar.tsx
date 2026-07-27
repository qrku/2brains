import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../model/usePointerTracker';

const ZOOM_STEP = 1.25;

interface Props {
  scale: number;
  onZoom: (factor: number) => void;
  onOpenSettings: () => void;
  uiProps: PointerTracker['uiProps'];
}

export function BoardBottomBar({ scale, onZoom, onOpenSettings, uiProps }: Props) {
  return (
    <div className="board-bar" {...uiProps}>
      <button className="board-btn board-btn-icon" onClick={() => onZoom(ZOOM_STEP)}>
        <Icon name="add" size={14} />
      </button>
      <span className="board-zoom-pct">{Math.round(scale * 100)}%</span>
      <button className="board-btn board-btn-icon" onClick={() => onZoom(1 / ZOOM_STEP)}>
        <Icon name="remove" size={14} />
      </button>

      <div style={{ flex: 1 }} />

      <button className="board-btn board-settings-btn" onClick={onOpenSettings} title="Настройки">
        <Icon name="settings-1" size={16} />
      </button>
    </div>
  );
}
