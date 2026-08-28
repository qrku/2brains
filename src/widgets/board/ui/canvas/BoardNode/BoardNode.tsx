'use client';

import { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DEF_PEN_COLOR,
  DEF_PEN_WIDTH,
  drawNodePoints,
  smoothPath,
  type BNode,
  type BoardNodeRef,
  type ResizeEdge,
  type Side,
} from '@/entities/board';
import { useSlashMenu } from '../../../model/slashMenu/useSlashMenu';
import { NodeText } from '../NodeText/NodeText';
import { SlashMenuPopup } from '../../slashMenu/SlashMenuPopup/SlashMenuPopup';
import type { NoteRef } from '../../NoteAside/NoteAside';
import { Icon } from '@/shared/ui/Icon';
import { cx } from '@/shared/lib/cx';
import styles from './BoardNode.module.css';

const SIDES: Side[] = ['n', 's', 'e', 'w'];
const RESIZE_EDGES: ResizeEdge[] = ['n', 's', 'e', 'w'];
const RESIZE_CORNERS: ResizeEdge[] = ['nw', 'ne', 'sw', 'se'];

/**
 * One stable object for every node, built once in BoardCanvas. Passing per-node closures here
 * instead would hand `memo` a fresh prop on every render and defeat it entirely.
 */
export interface NodeHandlers {
  onDown: (e: React.PointerEvent, node: BNode) => void;
  onEdit: (id: string) => void;
  onConnectorDown: (e: React.PointerEvent, node: BNode, side: Side) => void;
  onResizeDown: (e: React.PointerEvent, node: BNode, edge: ResizeEdge) => void;
  onTextInput: (id: string, text: string) => void;
  onBlur: () => void;
  onOpenNote: (note: NoteRef) => void;
}

interface Props {
  node: BNode;
  selected: boolean;
  soloSelected: boolean;
  editing: boolean;
  /** Side that a dragged arrow would snap to, when this node is the current drop target. */
  dropSide: Side | null;
  /** Файл Пространства, которым отражается эта нода; отсутствует у видов, которые не зеркалятся. */
  fileId?: string;
  fileName?: string;
  /** Адрес ноды-владельца файла — панель ищет по нему, где ещё файл используется. */
  fileOrigin?: BoardNodeRef;
  handlers: NodeHandlers;
}

export const BoardNode = memo(function BoardNode({
  node,
  selected,
  soloSelected,
  editing,
  dropSide,
  fileId,
  fileName,
  fileOrigin,
  handlers,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  const isText = node.kind === 'text';
  const isDraw = node.kind === 'draw';
  const isFrame = node.kind === 'frame';
  const isBox = node.kind === 'box';

  /**
   * Связанная копия ноды другой доски. Подпись берётся из имени файла оригинала, а не из
   * собственного `text`: файл ведёт исходная доска, и снимок текста, сделанный при вставке,
   * разошёлся бы с ним при первом же переименовании. `text` остаётся запасным вариантом на
   * случай оборванной связи — оригинал могли удалить.
   */
  const linked = !!node.link;
  const linkBroken = linked && !fileId;
  const label = linked && fileName ? fileName.replace(/\.md$/, '') : node.text;
  const isCircle = isBox && node.shape === 'circle';
  const centered = isCircle || (isBox && node.shape === 'diamond');

  const onTextInput = useCallback(
    (text: string) => handlers.onTextInput(node.id, text),
    [handlers, node.id],
  );
  // The slash menu (Space refs) only makes sense inside a block's body prose.
  const slash = useSlashMenu(editorRef, onTextInput, editing && isBox);

  // Seed the editor and drop the caret at the end. The contentEditable is uncontrolled — React
  // must not own its children, or every keystroke would reset the caret to the start.
  useEffect(() => {
    const el = editorRef.current;
    if (!editing || !el) return;

    el.textContent = node.text;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Deliberately not keyed on node.text: re-seeding mid-typing would fight the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // The board's own hotkeys (Delete, Esc, copy/paste) must not fire while typing.
      e.stopPropagation();
      if (slash.handleKeyDown(e)) return;

      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    [slash],
  );

  /**
   * Второй быстрый тап по блоку открывает его на правку — тем же жестом, что и
   * двойной клик мышью, которого на касании браузер не присылает.
   *
   * Распознаётся до `handlers.onDown`, а не после: тот сразу заводит
   * перетаскивание, и войти в правку с уехавшим под пальцем блоком было бы
   * нельзя. Порог по расстоянию отсекает случай, когда блок дважды подряд
   * подвинули.
   */
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') {
      const now = performance.now();
      const prev = lastTap.current;
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };

      const isDoubleTap =
        prev && now - prev.t < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24;
      if (isDoubleTap) {
        lastTap.current = null;
        e.stopPropagation();
        if (!isDraw) handlers.onEdit(node.id);
        return;
      }
    }
    handlers.onDown(e, node);
  };

  const className = cx(
    styles['board-node'],
    isText && styles['bk-text'],
    isDraw && styles['draw-kind'],
    isFrame && styles['bk-frame'],
    styles[`shape-${node.shape}`],
    selected && styles.sel,
    dropSide && styles['drop-target'],
    linked && styles.linked,
    linkBroken && styles['link-broken'],
  );

  return (
    <div
      className={className}
      style={{ left: node.x, top: node.y, width: node.w, height: isCircle ? node.w : node.h }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        if (isDraw) return;
        e.stopPropagation();
        handlers.onEdit(node.id);
      }}
    >
      {isBox && <div className={styles['node-bg']} />}

      {isDraw ? (
        <svg className={styles['board-draw-svg']} width={node.w} height={node.h} aria-hidden>
          <path
            d={smoothPath(drawNodePoints(node))}
            fill="none"
            stroke={node.color ?? DEF_PEN_COLOR}
            strokeWidth={node.strokeW ?? DEF_PEN_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : isFrame ? (
        editing ? (
          <div
            key="frame-edit"
            ref={editorRef}
            className={cx(styles['frame-label'], styles.editing)}
            style={{ fontSize: node.fontSize }}
            contentEditable
            suppressContentEditableWarning
            onPointerDown={(e) => e.stopPropagation()}
            onInput={(e) => onTextInput(e.currentTarget.textContent ?? '')}
            onBlur={() => handlers.onBlur()}
            onKeyDown={onKeyDown}
          />
        ) : (
          <div
            key="frame-label"
            className={styles['frame-label']}
            style={{ fontSize: node.fontSize }}
          >
            {label || 'Фрейм'}
          </div>
        )
      ) : (
        <div className={cx(styles['node-content'], centered && styles.centered)}>
          {editing ? (
            <div
              key="editable"
              ref={editorRef}
              className={styles['board-node-text']}
              style={{ fontSize: node.fontSize, lineHeight: 1.4, textAlign: node.align ?? 'left' }}
              contentEditable
              suppressContentEditableWarning
              onPointerDown={(e) => e.stopPropagation()}
              onInput={(e) => onTextInput(e.currentTarget.textContent ?? '')}
              onBlur={() => {
                if (!slash.open) handlers.onBlur();
              }}
              onKeyDown={onKeyDown}
            />
          ) : (
            <div
              key="display"
              className={styles['board-node-text']}
              style={{
                fontSize: node.fontSize,
                lineHeight: 1.4,
                color: label ? 'var(--ink)' : 'var(--text-5)',
                textAlign: node.align ?? 'left',
              }}
            >
              {label ? (
                // У связанной копии подпись — имя чужого файла, а не собственный текст:
                // разбирать в нём ссылки нечего, показываем как есть.
                linked ? (
                  label
                ) : (
                  <NodeText
                    text={label}
                    fontSize={node.fontSize}
                    onOpenNote={handlers.onOpenNote}
                  />
                )
              ) : (
                'Текст...'
              )}
            </div>
          )}
        </div>
      )}

      {linked && (
        <span
          className={styles['node-link-badge']}
          title={
            linkBroken
              ? 'Связь оборвана: оригинал удалён'
              : 'Связанная копия: файл общий с оригиналом, подпись ведёт исходная доска'
          }
        >
          <Icon name={linkBroken ? 'error' : 'link-1'} size={10} />
        </span>
      )}

      {fileId && !editing && (
        <button
          className={styles['node-file-btn']}
          title={`Открыть ${fileName ?? 'файл'}`}
          aria-label={`Открыть ${fileName ?? 'файл'}`}
          // Иначе нажатие уедет в drag-машину и вместо открытия файла начнётся перетаскивание.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handlers.onOpenNote({
              id: fileId,
              name: fileName ?? '',
              origin: fileOrigin,
              nodeId: node.id,
            });
          }}
        >
          <Icon name="file" size={11} />
        </button>
      )}

      {!isDraw &&
        !isFrame &&
        SIDES.map((side) => (
          <div
            key={side}
            className={cx(
              styles['board-handle'],
              styles[`bh-${side}`],
              dropSide === side && styles['bh-target'],
            )}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handlers.onConnectorDown(e, node, side);
            }}
          />
        ))}

      {soloSelected && (
        <>
          {/* Circles resize from the corners only — an edge handle can't express a square. */}
          {!isCircle &&
            RESIZE_EDGES.map((edge) => (
              <div
                key={`re-${edge}`}
                className={cx(styles['board-resize-edge'], styles[`re-${edge}`])}
                onPointerDown={(e) => handlers.onResizeDown(e, node, edge)}
              />
            ))}
          {RESIZE_CORNERS.map((edge) => (
            <div
              key={`rc-${edge}`}
              className={cx(styles['board-resize-corner'], styles[`rc-${edge}`])}
              onPointerDown={(e) => handlers.onResizeDown(e, node, edge)}
            />
          ))}
        </>
      )}

      {slash.open && createPortal(<SlashMenuPopup menu={slash} />, document.body)}
    </div>
  );
});
