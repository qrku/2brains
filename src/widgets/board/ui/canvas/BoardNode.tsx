'use client';

import { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DEF_PEN_COLOR,
  DEF_PEN_WIDTH,
  drawNodePoints,
  smoothPath,
  type BNode,
  type ResizeEdge,
  type Side,
} from '@/entities/board';
import { useSlashMenu } from '../../model/slashMenu/useSlashMenu';
import { NodeText } from './NodeText';
import { SlashMenuPopup } from '../slashMenu/SlashMenuPopup';
import type { NoteRef } from '../NoteAside';

const SIDES: Side[] = ['n', 's', 'e', 'w'];
const RESIZE_EDGES: ResizeEdge[] = ['n', 's', 'e', 'w'];
const RESIZE_CORNERS: ResizeEdge[] = ['nw', 'ne', 'sw', 'se'];

/**
 * One stable object for every node, built once in BoardCanvas. Passing per-node closures here
 * instead would hand `memo` a fresh prop on every render and defeat it entirely.
 */
export interface NodeHandlers {
  onDown: (e: React.MouseEvent, node: BNode) => void;
  onEdit: (id: string) => void;
  onConnectorDown: (e: React.MouseEvent, node: BNode, side: Side) => void;
  onResizeDown: (e: React.MouseEvent, node: BNode, edge: ResizeEdge) => void;
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
  handlers: NodeHandlers;
}

export const BoardNode = memo(function BoardNode({
  node,
  selected,
  soloSelected,
  editing,
  dropSide,
  handlers,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  const isText = node.kind === 'text';
  const isDraw = node.kind === 'draw';
  const isFrame = node.kind === 'frame';
  const isBox = node.kind === 'box';
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

  const className = [
    'board-node',
    isText && 'bk-text',
    isDraw && 'draw-kind',
    isFrame && 'bk-frame',
    `shape-${node.shape}`,
    selected && 'sel',
    dropSide && 'drop-target',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{ left: node.x, top: node.y, width: node.w, height: isCircle ? node.w : node.h }}
      onMouseDown={(e) => handlers.onDown(e, node)}
      onDoubleClick={(e) => {
        if (isDraw) return;
        e.stopPropagation();
        handlers.onEdit(node.id);
      }}
    >
      {isBox && <div className="node-bg" />}

      {isDraw ? (
        <svg className="board-draw-svg" width={node.w} height={node.h} aria-hidden>
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
            className="frame-label editing"
            style={{ fontSize: node.fontSize }}
            contentEditable
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
            onInput={(e) => onTextInput(e.currentTarget.textContent ?? '')}
            onBlur={() => handlers.onBlur()}
            onKeyDown={onKeyDown}
          />
        ) : (
          <div key="frame-label" className="frame-label" style={{ fontSize: node.fontSize }}>
            {node.text || 'Фрейм'}
          </div>
        )
      ) : (
        <div className={`node-content${centered ? ' centered' : ''}`}>
          {editing ? (
            <div
              key="editable"
              ref={editorRef}
              className="board-node-text"
              style={{ fontSize: node.fontSize, lineHeight: 1.4, textAlign: node.align ?? 'left' }}
              contentEditable
              suppressContentEditableWarning
              onMouseDown={(e) => e.stopPropagation()}
              onInput={(e) => onTextInput(e.currentTarget.textContent ?? '')}
              onBlur={() => {
                if (!slash.open) handlers.onBlur();
              }}
              onKeyDown={onKeyDown}
            />
          ) : (
            <div
              key="display"
              className="board-node-text"
              style={{
                fontSize: node.fontSize,
                lineHeight: 1.4,
                color: node.text ? 'var(--ink)' : 'var(--text-5)',
                textAlign: node.align ?? 'left',
              }}
            >
              {node.text ? (
                <NodeText
                  text={node.text}
                  fontSize={node.fontSize}
                  onOpenNote={handlers.onOpenNote}
                />
              ) : (
                'Текст...'
              )}
            </div>
          )}
        </div>
      )}

      {!isDraw &&
        !isFrame &&
        SIDES.map((side) => (
          <div
            key={side}
            className={`board-handle bh-${side}${dropSide === side ? ' bh-target' : ''}`}
            onMouseDown={(e) => {
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
                className={`board-resize-edge re-${edge}`}
                onMouseDown={(e) => handlers.onResizeDown(e, node, edge)}
              />
            ))}
          {RESIZE_CORNERS.map((edge) => (
            <div
              key={`rc-${edge}`}
              className={`board-resize-corner rc-${edge}`}
              onMouseDown={(e) => handlers.onResizeDown(e, node, edge)}
            />
          ))}
        </>
      )}

      {slash.open && createPortal(<SlashMenuPopup menu={slash} />, document.body)}
    </div>
  );
});
