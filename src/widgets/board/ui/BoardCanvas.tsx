'use client';

import { useMemo, useRef, useState } from 'react';
import { useRegisterTools } from '@/features/ai-agent';
import { distToSegment, nodesInFrame, toC, type BEdge, type XY } from '@/entities/board';
import { createBoardTools } from '../model/agentTools';
import { useBoards } from '../model/useBoards';
import { useBoardStore } from '../model/useBoardStore';
import { useBoardGeometry, viewportCursor } from '../model/useBoardGeometry';
import { useBoardHotkeys } from '../model/useBoardHotkeys';
import { useBoardWheel } from '../model/useBoardWheel';
import { useDragMachine } from '../model/useDragMachine';
import { useEdgePan } from '../model/useEdgePan';
import { usePointerTracker } from '../model/usePointerTracker';
import { viewportPoint } from '../model/pointer';
import { BoardBottomBar } from './BoardBottomBar';
import { BoardEdges } from './BoardEdges';
import { BoardHint } from './BoardHint';
import { BoardNode, type NodeHandlers } from './BoardNode';
import { BoardSettingsModal } from './BoardSettingsModal';
import { BoardSwitcher } from './BoardSwitcher';
import { BoardToolbar } from './BoardToolbar';
import { FrameWheel } from './FrameWheel';
import { NoteAside, type NoteRef } from './NoteAside';
import { PenPanel } from './PenPanel';
import { EdgeActionBar, MultiSelectBar, NodePropertyBar } from './PropertyBars';

export function BoardCanvas() {
  const vpRef = useRef<HTMLDivElement>(null);

  const boards = useBoards();
  const store = useBoardStore(boards.current?.id ?? null);
  const { state, dispatch, stateRef } = store;
  const tracker = usePointerTracker(vpRef);

  useDragMachine(store, vpRef);
  useBoardWheel(store, vpRef, tracker);
  useEdgePan(store, vpRef, tracker);
  const spacePan = useBoardHotkeys(store, tracker);

  // Инструменты Доски живут ровно столько, сколько смонтирован холст: они читают состояние
  // через `store.stateRef`, который вне этого компонента перестаёт обновляться.
  useRegisterTools('board', useMemo(() => createBoardTools(store), [store]));

  const geom = useBoardGeometry(state);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [note, setNote] = useState<NoteRef | null>(null);

  const { view, tool, nodes, selected, selectedEdge, editing } = state;

  // Frames are containers, so they paint behind everything else. A stable partition (rather than a
  // sort) keeps each node's relative order — and thus its React key position — untouched.
  const renderNodes = useMemo(() => {
    if (!nodes.some((n) => n.kind === 'frame')) return nodes;
    return [...nodes.filter((n) => n.kind === 'frame'), ...nodes.filter((n) => n.kind !== 'frame')];
  }, [nodes]);

  // Frames listed for the jump rail, ordered the way they read on the canvas: top-to-bottom.
  const frames = useMemo(
    () => nodes.filter((n) => n.kind === 'frame').sort((a, b) => a.y - b.y || a.x - b.x),
    [nodes],
  );
  const activeFrameId = selected.length === 1 && frames.some((f) => f.id === selected[0]) ? selected[0] : null;

  const focusFrame = (id: string) => {
    const vp = vpRef.current;
    if (!vp) return;
    dispatch({ type: 'EDIT', id: null });
    dispatch({ type: 'SELECT', ids: [id] });
    dispatch({ type: 'FOCUS_NODE', id, width: vp.offsetWidth, height: vp.offsetHeight });
  };

  /* ── Viewport ─────────────────────────────────────────────────────── */

  // Only fires for clicks that reach the viewport itself — nodes and panels stop propagation.
  const onViewportDown = (e: React.MouseEvent) => {
    if (e.target !== vpRef.current) return;
    const { editing, tool, view } = stateRef.current;

    if (editing) dispatch({ type: 'EDIT', id: null });
    dispatch({ type: 'SELECT_EDGE', id: null });

    // Middle button, Space+LMB, or the hand tool all mean "pan".
    if (e.button === 1 || (e.button === 0 && (spacePan || tool === 'hand'))) {
      e.preventDefault();
      dispatch({ type: 'DRAG_START', drag: { type: 'pan', startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y } });
      return;
    }
    if (e.button !== 0) return;

    const { x: sx, y: sy } = viewportPoint(e, vpRef.current);
    dispatch({ type: 'SELECT', ids: [] });

    if (tool === 'cursor') {
      dispatch({ type: 'DRAG_START', drag: { type: 'select', sx, sy, ex: sx, ey: sy } });
    } else if (tool === 'pencil') {
      dispatch({ type: 'DRAG_START', drag: { type: 'pencil', points: [toC(sx, sy, view)] } });
    } else {
      dispatch({ type: 'DRAG_START', drag: { type: 'draw', sx, sy, ex: sx, ey: sy } });
    }
  };

  const onViewportDblClick = (e: React.MouseEvent) => {
    if (e.target !== vpRef.current || stateRef.current.tool !== 'cursor') return;
    const { x, y } = viewportPoint(e, vpRef.current);
    dispatch({ type: 'ADD_NODE', pos: toC(x, y, stateRef.current.view) });
  };

  const onZoom = (factor: number) => {
    const vp = vpRef.current;
    if (!vp) return;
    dispatch({ type: 'ZOOM_AT', factor, mx: vp.offsetWidth / 2, my: vp.offsetHeight / 2 });
  };

  /* ── Nodes ────────────────────────────────────────────────────────── */

  // Stable for the component's lifetime — see NodeHandlers on why that matters.
  const nodeHandlers = useMemo<NodeHandlers>(() => ({
    onDown: (e, node) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const { editing, selected, nodes } = stateRef.current;

      // Keep the contentEditable focused while dragging the node it belongs to.
      if (editing === node.id) e.preventDefault();
      dispatch({ type: 'SELECT_EDGE', id: null });

      let ids: string[];
      if (e.ctrlKey || e.metaKey) {
        ids = selected.includes(node.id)
          ? selected.filter((id) => id !== node.id)
          : [...selected, node.id];
        dispatch({ type: 'SELECT', ids });
      } else if (selected.includes(node.id)) {
        // Dragging one node of an existing multi-selection moves the whole group.
        ids = selected;
      } else {
        ids = [node.id];
        dispatch({ type: 'SELECT', ids });
      }

      // Dragging a frame carries its contents: fold every node currently inside a selected frame
      // into the move set, so the frame behaves as one logical unit. Membership is purely spatial,
      // so a block simply dropped inside a frame is picked up next time the frame moves.
      const moving = new Set(ids);
      for (const n of nodes) {
        if (n.kind === 'frame' && ids.includes(n.id)) {
          for (const m of nodesInFrame(nodes, n)) moving.add(m.id);
        }
      }

      const origins: Record<string, XY> = {};
      for (const n of nodes) {
        if (moving.has(n.id)) origins[n.id] = { x: n.x, y: n.y };
      }
      dispatch({ type: 'DRAG_START', drag: { type: 'nodes', ids: [...moving], startX: e.clientX, startY: e.clientY, origins } });
    },

    onEdit: (id) => dispatch({ type: 'EDIT', id }),

    onConnectorDown: (e, node, side) => {
      dispatch({ type: 'SELECT_EDGE', id: null });
      const { x, y } = viewportPoint(e, vpRef.current);
      dispatch({ type: 'DRAG_START', drag: { type: 'edge', fromId: node.id, fromSide: side, toSX: x, toSY: y } });
    },

    onResizeDown: (e, node, edge) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      dispatch({
        type: 'DRAG_START',
        drag: {
          type: 'resize', id: node.id, edge,
          startX: e.clientX, startY: e.clientY,
          origin: { x: node.x, y: node.y, w: node.w, h: node.h },
        },
      });
    },

    onTextInput: (id, text) => dispatch({ type: 'SET_TEXT', id, text }),
    onBlur: () => dispatch({ type: 'EDIT', id: null }),
    onOpenNote: setNote,
  }), [dispatch, stateRef]);

  /* ── Edges ────────────────────────────────────────────────────────── */

  const onEdgeDown = (e: React.MouseEvent, edge: BEdge, verts: XY[]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch({ type: 'SELECT', ids: [] });

    if (stateRef.current.selectedEdge !== edge.id) {
      dispatch({ type: 'SELECT_EDGE', id: edge.id });
      return;
    }

    // Clicking an already-selected arrow drops a bend point on the segment nearest the cursor.
    const { x, y } = viewportPoint(e, vpRef.current);
    const pt = toC(x, y, stateRef.current.view);

    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < verts.length - 1; i++) {
      const d = distToSegment(pt, verts[i], verts[i + 1]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    dispatch({ type: 'ADD_EDGE_BEND', edgeId: edge.id, index: bestIdx, pt });
  };

  const onBendDown = (e: React.MouseEvent, edgeId: string, index: number, origin: XY) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dispatch({ type: 'DRAG_START', drag: { type: 'edgePoint', edgeId, index, startX: e.clientX, startY: e.clientY, origin } });
  };

  const onBendDelete = (e: React.MouseEvent, edgeId: string, index: number) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_EDGE_POINT', edgeId, index });
  };

  const deleteSelection = () => dispatch({ type: 'DELETE_SELECTION' });

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <div className="board-wrap">
      <div
        ref={vpRef}
        className="board-vp"
        style={{ cursor: viewportCursor(state, spacePan) }}
        onMouseDown={onViewportDown}
        onDoubleClick={onViewportDblClick}
        {...tracker.viewportProps}
      >
        <BoardEdges
          arrows={geom.arrows}
          selectedEdge={selectedEdge}
          previewPath={geom.previewPath}
          pencilPath={geom.pencilPath}
          penColor={state.penColor}
          penWidth={state.penWidth}
          scale={view.scale}
          onEdgeDown={onEdgeDown}
          onBendDown={onBendDown}
          onBendDelete={onBendDelete}
        />

        <div
          className="board-canvas"
          style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
        >
          {renderNodes.map((node) => (
            <BoardNode
              key={node.id}
              node={node}
              selected={selected.includes(node.id)}
              soloSelected={selected.length === 1 && selected[0] === node.id}
              editing={editing === node.id}
              dropSide={geom.dropTargetId === node.id ? geom.dropTargetSide : null}
              handlers={nodeHandlers}
            />
          ))}
        </div>

        {geom.edgeActionAnchor && (
          <EdgeActionBar at={geom.edgeActionAnchor} onDelete={deleteSelection} />
        )}

        {geom.drawPreview && (
          <div
            className="board-draw-preview"
            style={{ left: geom.drawPreview.left, top: geom.drawPreview.top, width: geom.drawPreview.w, height: geom.drawPreview.h }}
          />
        )}

        {geom.selectRect && (
          <div
            className="board-select-rect"
            style={{ left: geom.selectRect.left, top: geom.selectRect.top, width: geom.selectRect.w, height: geom.selectRect.h }}
          />
        )}

        {geom.guides.map((g, i) => (
          <div
            key={i}
            className={`board-guide board-guide-${g.axis}`}
            style={g.axis === 'x'
              ? { left: g.x, top: g.y, height: g.length }
              : { left: g.x, top: g.y, width: g.length }}
          />
        ))}

        {geom.selectedNode && geom.propsAnchor && (
          <NodePropertyBar
            at={geom.propsAnchor}
            node={geom.selectedNode}
            onFontSize={(delta) => dispatch({ type: 'FONT_SIZE', id: geom.selectedNode!.id, delta })}
            onShape={(shape) => dispatch({ type: 'SET_SHAPE', id: geom.selectedNode!.id, shape })}
            onAlign={(align) => dispatch({ type: 'SET_ALIGN', id: geom.selectedNode!.id, align })}
            onStrokeColor={(color) => dispatch({ type: 'STROKE_COLOR', id: geom.selectedNode!.id, color })}
            onStrokeWidth={(delta) => dispatch({ type: 'STROKE_WIDTH', id: geom.selectedNode!.id, delta })}
            onDelete={deleteSelection}
          />
        )}

        {geom.multiAnchor && (
          <MultiSelectBar at={geom.multiAnchor} count={selected.length} onDelete={deleteSelection} />
        )}

        <BoardSwitcher boards={boards} uiProps={tracker.uiProps} />

        <BoardToolbar
          tool={tool}
          onSelect={(t) => dispatch({ type: 'SET_TOOL', tool: t })}
          uiProps={tracker.uiProps}
        />

        <FrameWheel
          frames={frames}
          activeId={activeFrameId}
          onFocus={focusFrame}
          uiProps={tracker.uiProps}
        />

        {tool === 'pencil' && (
          <PenPanel
            color={state.penColor}
            width={state.penWidth}
            onColor={(color) => dispatch({ type: 'SET_PEN_COLOR', color })}
            onWidth={(delta) => dispatch({ type: 'PEN_WIDTH', delta })}
            uiProps={tracker.uiProps}
          />
        )}

        <BoardBottomBar
          scale={view.scale}
          onZoom={onZoom}
          onOpenSettings={() => setSettingsOpen(true)}
          uiProps={tracker.uiProps}
        />

        <BoardHint tool={tool} />

        {settingsOpen && (
          <BoardSettingsModal
            settings={state.settings}
            onChange={(patch) => dispatch({ type: 'UPDATE_SETTINGS', patch })}
            onClose={() => setSettingsOpen(false)}
            uiProps={tracker.uiProps}
          />
        )}
      </div>

      <NoteAside note={note} onClose={() => setNote(null)} />
    </div>
  );
}
