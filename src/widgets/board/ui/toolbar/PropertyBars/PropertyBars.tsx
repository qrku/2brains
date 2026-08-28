import {
  DEF_PEN_COLOR,
  DEF_PEN_WIDTH,
  type BNode,
  type NodeShape,
  type TextAlign,
  type XY,
} from '@/entities/board';
import { Icon } from '@/shared/ui/Icon';
import { ALIGNS, SHAPES } from '../../config';
import { StrokeControls } from '../StrokeControls';
import { cx } from '@/shared/lib/cx';
import styles from './PropertyBars.module.css';

/** Three stacked lines whose horizontal offsets encode the alignment. */
function AlignGlyph({ align }: { align: TextAlign }) {
  // Each row is [x, width]; short rows shift with the alignment, full rows span the box.
  const rows: [number, number][] =
    align === 'center'
      ? [
          [1, 12],
          [3, 8],
          [1, 12],
          [3, 8],
        ]
      : align === 'right'
        ? [
            [2, 12],
            [6, 8],
            [2, 12],
            [6, 8],
          ]
        : [
            [2, 12],
            [2, 8],
            [2, 12],
            [2, 8],
          ];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      {rows.map(([x, w], i) => (
        <rect key={i} x={x} y={2 + i * 3} width={w} height="1.4" rx="0.7" fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * Floating bar pinned above whatever is selected.
 *
 * `at: null` — вариант для пальца: панель не привязана к блоку, а встаёт полосой
 * сверху холста. Блок в этот момент правят, то есть он под пальцем и наполовину
 * под клавиатурой, а панель над ним то и дело оказывалась бы за краем экрана.
 */
function Bar({ at, children }: { at: XY | null; children: React.ReactNode }) {
  return (
    <div
      className={cx(styles['board-props'], !at && styles.docked)}
      style={at ? { left: at.x, top: at.y } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      className={cx(styles['bp-btn'], styles['bp-del'])}
      title="Удалить (Del)"
      onClick={onDelete}
    >
      <Icon name="close" size={13} />
    </button>
  );
}

interface NodeBarProps {
  /** `null` — панель полосой сверху холста, см. `Bar`. */
  at: XY | null;
  node: BNode;
  onFontSize: (delta: number) => void;
  onShape: (shape: NodeShape) => void;
  onAlign: (align: TextAlign) => void;
  onStrokeColor: (color: string) => void;
  onStrokeWidth: (delta: number) => void;
  onDelete: () => void;
  /** Разорвать связь с оригиналом; передаётся только для связанной копии. */
  onUnlink?: () => void;
  /** Закрыть панель. Есть только у варианта для пальца: мышь закрывает её выделением. */
  onClose?: () => void;
}

export function NodePropertyBar({
  at,
  node,
  onFontSize,
  onShape,
  onAlign,
  onStrokeColor,
  onStrokeWidth,
  onDelete,
  onUnlink,
  onClose,
}: NodeBarProps) {
  return (
    <Bar at={at}>
      {onUnlink && (
        <>
          <button
            className={styles['bp-btn']}
            onClick={onUnlink}
            title="Отвязать: сделать самостоятельную копию со своим файлом"
          >
            <Icon name="flip" size={13} />
          </button>
          <div className={styles['bp-sep']} />
        </>
      )}
      {node.kind === 'draw' ? (
        <StrokeControls
          color={node.color ?? DEF_PEN_COLOR}
          width={node.strokeW ?? DEF_PEN_WIDTH}
          onColor={onStrokeColor}
          onWidth={onStrokeWidth}
        />
      ) : (
        <>
          <button className={styles['bp-btn']} onClick={() => onFontSize(-2)} title="Уменьшить">
            A−
          </button>
          <span className={styles['bp-val']}>{node.fontSize}px</span>
          <button className={styles['bp-btn']} onClick={() => onFontSize(+2)} title="Увеличить">
            A+
          </button>

          {node.kind !== 'frame' && (
            <>
              <div className={styles['bp-sep']} />
              {ALIGNS.map((a) => (
                <button
                  key={a.id}
                  className={cx(
                    styles['bp-btn'],
                    styles['bp-align'],
                    (node.align ?? 'left') === a.id && styles.active,
                  )}
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
              <div className={styles['bp-sep']} />
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  className={cx(
                    styles['bp-btn'],
                    styles['bp-shape'],
                    node.shape === s.id && styles.active,
                  )}
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
      <div className={styles['bp-sep']} />
      <DeleteButton onDelete={onDelete} />
      {/* Своей строкой во всю ширину — разделитель ей не нужен, её отбивает сам перенос. */}
      {onClose && (
        <button className={cx(styles['bp-btn'], styles['bp-done'])} onClick={onClose}>
          Готово
        </button>
      )}
    </Bar>
  );
}

export function MultiSelectBar({
  at,
  count,
  onDelete,
}: {
  at: XY;
  count: number;
  onDelete: () => void;
}) {
  return (
    <Bar at={at}>
      <span className={styles['bp-val']}>{count} выбрано</span>
      <div className={styles['bp-sep']} />
      <DeleteButton onDelete={onDelete} />
    </Bar>
  );
}

export function EdgeActionBar({ at, onDelete }: { at: XY; onDelete: () => void }) {
  return (
    <Bar at={at}>
      <span className={styles['bp-val']}>Стрелка</span>
      <div className={styles['bp-sep']} />
      <DeleteButton onDelete={onDelete} />
    </Bar>
  );
}
