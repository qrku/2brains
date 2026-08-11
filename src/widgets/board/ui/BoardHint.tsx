import type { Tool } from '../model/types';

const HINTS: Record<Tool, React.ReactNode> = {
  cursor: (
    <>
      Потяни — выделить · Клик по блоку — выбрать · Двойной клик — редактировать текст ·{' '}
      <span className="board-hint-dot">●</span> — стрелка · Клик по стрелке — выделить, ещё раз —
      изгиб
    </>
  ),
  hand: <>Потяни — переместить доску</>,
  pencil: <>Рисуй — свободные линии · Esc — выйти из режима</>,
  box: <>Кликни или потяни — создать · Esc — отмена</>,
  text: <>Кликни или потяни — создать · Esc — отмена</>,
  frame: (
    <>Кликни или потяни — создать фрейм · Блоки внутри двигаются вместе с ним · Esc — отмена</>
  ),
};

export function BoardHint({ tool }: { tool: Tool }) {
  return <div className="board-hint">{HINTS[tool]}</div>;
}
