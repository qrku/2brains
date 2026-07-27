import { DEF_PEN_COLOR, DEF_PEN_WIDTH, type BNode, type NodeShape, type TextAlign, type XY } from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import { ALIGNS, SHAPES } from './config';
import { StrokeControls } from './StrokeControls';

/** Three stacked lines whose horizontal offsets encode the alignment. */
function AlignGlyph({ align }: { align: TextAlign }) {
  // Each row is [x, width]; short rows shift with the alignment, full rows span the box.
  const rows: [number, number][] =
    align === 'center'
      ? [[1, 12], [3, 8], [1, 12], [3, 8]]
      : align === 'right'
        ? [[2, 12], [6, 8], [2, 12], [6, 8]]
        : [[2, 12], [2, 8], [2, 12], [2, 8]];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      {rows.map(([x, w], i) => (
        <rect key={i} x={x} y={2 + i * 3} width={w} height="1.4" rx="0.7" fill="currentColor" />
      ))}
    </svg>
  );
}

/** Floating bar pinned above whatever is selected. */
function Bar({ at, children }: { at: XY; children: React.ReactNode }) {
  return (
    <div
      className="board-props"
      style={{ left: at.x, top: at.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button className="bp-btn bp-del" title="Удалить (Del)" onClick={onDelete}>
      <Icon name="close" size={13} />
    </button>
  );
}

interface NodeBarProps {
  at: XY;
  node: BNode;
  onFontSize: (delta: number) => void;
  onShape: (shape: NodeShape) => void;
  onAlign: (align: TextAlign) => void;
  onStrokeColor: (color: string) => void;
  onStrokeWidth: (delta: number) => void;
  onDelete: () => void;
}

export function NodePropertyBar({ at, node, onFontSize, onShape, onAlign, onStrokeColor, onStrokeWidth, onDelete }: NodeBarProps) {
  return (
    <Bar at={at}>
      {node.kind === 'draw' ? (
        <StrokeControls
          color={node.color ?? DEF_PEN_COLOR}
          width={node.strokeW ?? DEF_PEN_WIDTH}
          onColor={onStrokeColor}
          onWidth={onStrokeWidth}
        />
      ) : (
        <>
          <button className="bp-btn" onClick={() => onFontSize(-2)} title="Уменьшить">A−</button>
          <span className="bp-val">{node.fontSize}px</span>
          <button className="bp-btn" onClick={() => onFontSize(+2)} title="Увеличить">A+</button>

          {node.kind !== 'frame' && (
            <>
              <div className="bp-sep" />
              {ALIGNS.map((a) => (
                <button
                  key={a.id}
                  className={`bp-btn bp-align${(node.align ?? 'left') === a.id ? ' active' : ''}`}
                  title={a.label}
                  onClick={() => onAlign(a.id)}
                >
                  <AlignGlyph align={a.id} />
                </button>
              ))}
            </>
          )}

          {node.kind === 'box' && (
            <>
              <div className="bp-sep" />
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  className={`bp-btn bp-shape${node.shape === s.id ? ' active' : ''}`}
                  title={s.label}
                  onClick={() => onShape(s.id)}
                >
                  {s.icon}
                </button>
              ))}
            </>
          )}
        </>
      )}
      <div className="bp-sep" />
      <DeleteButton onDelete={onDelete} />
    </Bar>
  );
}

export function MultiSelectBar({ at, count, onDelete }: { at: XY; count: number; onDelete: () => void }) {
  return (
    <Bar at={at}>
      <span className="bp-val">{count} выбрано</span>
      <div className="bp-sep" />
      <DeleteButton onDelete={onDelete} />
    </Bar>
  );
}

export function EdgeActionBar({ at, onDelete }: { at: XY; onDelete: () => void }) {
  return (
    <Bar at={at}>
      <span className="bp-val">Стрелка</span>
      <div className="bp-sep" />
      <DeleteButton onDelete={onDelete} />
    </Bar>
  );
}
