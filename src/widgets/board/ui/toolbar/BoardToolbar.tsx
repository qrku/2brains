import { Icon } from '@/shared/ui/Icon';
import type { PointerTracker } from '../../model/dragging/usePointerTracker';
import type { Tool } from '../../model/types';
import { TOOLS } from '../config';

interface Props {
  tool: Tool;
  onSelect: (tool: Tool) => void;
  uiProps: PointerTracker['uiProps'];
}

export function BoardToolbar({ tool, onSelect, uiProps }: Props) {
  return (
    <div className="board-panel" {...uiProps}>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`board-panel-btn${tool === t.id ? ' active' : ''}`}
          onClick={() => onSelect(t.id)}
          title={t.label}
        >
          <span className="board-panel-icon">
            <Icon name={t.icon} size={18} />
          </span>
          <span className="board-panel-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
