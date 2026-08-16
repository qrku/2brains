import type { PointerTracker } from '../../model/dragging/usePointerTracker';
import { StrokeControls } from './StrokeControls';

interface Props {
  color: string;
  width: number;
  onColor: (color: string) => void;
  onWidth: (delta: number) => void;
  uiProps: PointerTracker['uiProps'];
}

/** Colour and thickness for the *next* pencil stroke. Only shown while the pencil is active. */
export function PenPanel({ color, width, onColor, onWidth, uiProps }: Props) {
  return (
    <div className="board-pen-panel" {...uiProps}>
      <StrokeControls color={color} width={width} onColor={onColor} onWidth={onWidth} />
    </div>
  );
}
