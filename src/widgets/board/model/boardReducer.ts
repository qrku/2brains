import { uid } from '@/shared/lib/uid';
import {
  CONNECTOR_MAGNET,
  DEF_FRAME_H,
  DEF_FRAME_W,
  DEF_H,
  DEF_PEN_COLOR,
  DEF_PEN_WIDTH,
  DEF_SETTINGS,
  DEF_VIEW,
  DEF_W,
  MIN_DRAW_PX,
  MIN_S,
  PEN_MAX_W,
  PEN_MIN_W,
  SNAP_PX,
  boundsOf,
  clamp,
  computeResizeSnap,
  computeSnap,
  findConnectorMagnet,
  mkDrawNode,
  mkNode,
  nodesInFrame,
  nodesInRect,
  resizeGuides,
  toC,
  zoomTo,
  type BNode,
  type BoardNodeRef,
  type Rect,
  type XY,
} from '@/entities/board';
import type { BoardAction, BoardState, PasteMode, PointerPos } from './types';

/** Below this screen distance, a select drag is treated as a click on empty canvas. */
const SELECT_THRESHOLD_PX = 4;
/** Minimum on-screen spacing between captured pencil points. */
const PENCIL_SAMPLE_PX = 2;
const MIN_NODE_W = 40,
  MIN_NODE_H = 24;
const FIT_PADDING = 80,
  FIT_MAX_SCALE = 1.5;

export const initialBoardState: BoardState = {
  ready: false,
  boardId: null,
  nodes: [],
  edges: [],
  view: DEF_VIEW,
  selected: [],
  selectedEdge: null,
  editing: null,
  drag: { type: 'none' },
  guides: [],
  tool: 'cursor',
  penColor: DEF_PEN_COLOR,
  penWidth: DEF_PEN_WIDTH,
  settings: DEF_SETTINGS,
  clipboard: null,
};

const mapNode = (nodes: BNode[], id: string, fn: (n: BNode) => BNode): BNode[] =>
  nodes.map((n) => (n.id === id ? fn(n) : n));

/** Resize keeps circles square: diagonal handles average the two axes, edge handles drive both. */
function resizeNode(
  n: BNode,
  o: { x: number; y: number; w: number; h: number },
  edge: string,
  dx: number,
  dy: number,
  scale: number,
): BNode {
  const minW = MIN_NODE_W / scale,
    minH = MIN_NODE_H / scale;
  const hasN = edge.includes('n'),
    hasS = edge.includes('s');
  const hasE = edge.includes('e'),
    hasW = edge.includes('w');

  if (n.shape === 'circle') {
    const dH = hasE ? dx : hasW ? -dx : 0;
    const dV = hasS ? dy : hasN ? -dy : 0;
    const delta = (hasE || hasW) && (hasN || hasS) ? (dH + dV) / 2 : dH || dV;
    const size = Math.max(minW, o.w + delta);
    return {
      ...n,
      x: hasW ? o.x + (o.w - size) : o.x,
      y: hasN ? o.y + (o.h - size) : o.y,
      w: size,
      h: size,
    };
  }

  let x = o.x,
    y = o.y,
    w = o.w,
    h = o.h;
  if (hasE) w = Math.max(minW, o.w + dx);
  if (hasW) {
    const nw = Math.max(minW, o.w - dx);
    x = o.x + (o.w - nw);
    w = nw;
  }
  if (hasS) h = Math.max(minH, o.h + dy);
  if (hasN) {
    const nh = Math.max(minH, o.h - dy);
    y = o.y + (o.h - nh);
    h = nh;
  }
  return { ...n, x, y, w, h };
}

function onDragMove(state: BoardState, pos: PointerPos): BoardState {
  const d = state.drag,
    t = state.view;
  const { sx, sy, clientX, clientY } = pos;

  switch (d.type) {
    case 'pan':
      return {
        ...state,
        view: { x: d.ox + (clientX - d.startX), y: d.oy + (clientY - d.startY), scale: t.scale },
      };

    case 'nodes': {
      const dx = (clientX - d.startX) / t.scale;
      const dy = (clientY - d.startY) / t.scale;

      // Smart-align the moving group's bounding box against the nodes staying put. Draw strokes
      // make noisy targets, so they're left out.
      let x1 = Infinity,
        y1 = Infinity,
        x2 = -Infinity,
        y2 = -Infinity;
      const statics: BNode[] = [];
      for (const n of state.nodes) {
        const o = d.origins[n.id];
        if (o) {
          const nx = o.x + dx,
            ny = o.y + dy;
          x1 = Math.min(x1, nx);
          y1 = Math.min(y1, ny);
          x2 = Math.max(x2, nx + n.w);
          y2 = Math.max(y2, ny + n.h);
        } else if (n.kind !== 'draw') {
          statics.push(n);
        }
      }

      const mv: Rect = { x1, y1, x2, y2 };
      const { snapX, snapY, guides } = computeSnap(mv, statics, SNAP_PX / t.scale);

      return {
        ...state,
        guides,
        nodes: state.nodes.map((n) => {
          const o = d.origins[n.id];
          return o ? { ...n, x: o.x + dx + snapX, y: o.y + dy + snapY } : n;
        }),
      };
    }

    case 'edge':
      return { ...state, drag: { ...d, toSX: sx, toSY: sy } };

    case 'draw':
      return { ...state, drag: { ...d, ex: sx, ey: sy } };

    case 'select': {
      // Selection is resolved live here, so drag-end has nothing left to recompute.
      const moved =
        Math.abs(sx - d.sx) > SELECT_THRESHOLD_PX || Math.abs(sy - d.sy) > SELECT_THRESHOLD_PX;
      const selected = moved
        ? nodesInRect(state.nodes, toC(d.sx, d.sy, t), toC(sx, sy, t)).map((n) => n.id)
        : [];
      return { ...state, drag: { ...d, ex: sx, ey: sy }, selected };
    }

    case 'resize': {
      const dx = (clientX - d.startX) / t.scale;
      const dy = (clientY - d.startY) / t.scale;

      // Snap the dragged edge(s) against the nodes staying put — same smart-align as a move drag,
      // but only the sides the handle moves are matched. Draw strokes make noisy targets, so skip them.
      const statics = state.nodes.filter((n) => n.id !== d.id && n.kind !== 'draw');
      const { ddx, ddy, alignX, alignY } = computeResizeSnap(
        d.origin,
        d.edge,
        dx,
        dy,
        statics,
        SNAP_PX / t.scale,
      );

      const nodes = mapNode(state.nodes, d.id, (n) =>
        resizeNode(n, d.origin, d.edge, dx + ddx, dy + ddy, t.scale),
      );
      const node = nodes.find((n) => n.id === d.id);
      // Ноду могли удалить прямо во время ресайза (Delete с зажатым углом) — тогда
      // следующий mousemove не должен ронять доску чтением полей у undefined.
      if (!node) return state;
      const box: Rect = { x1: node.x, y1: node.y, x2: node.x + node.w, y2: node.y + node.h };
      return { ...state, guides: resizeGuides(box, statics, alignX, alignY), nodes };
    }

    case 'edgePoint': {
      const dx = (clientX - d.startX) / t.scale;
      const dy = (clientY - d.startY) / t.scale;
      return {
        ...state,
        edges: state.edges.map((ev) =>
          ev.id !== d.edgeId
            ? ev
            : {
                ...ev,
                points: ev.points.map((p, i) =>
                  i === d.index ? { x: d.origin.x + dx, y: d.origin.y + dy } : p,
                ),
              },
        ),
      };
    }

    case 'pencil': {
      const p = toC(sx, sy, t);
      const last = d.points[d.points.length - 1];
      // Thin out the capture: sample no denser than PENCIL_SAMPLE_PX on screen.
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < PENCIL_SAMPLE_PX / t.scale) return state;
      return { ...state, drag: { ...d, points: [...d.points, p] } };
    }

    default:
      return state;
  }
}

function onDragEnd(state: BoardState, pos: PointerPos): BoardState {
  const d = state.drag,
    t = state.view;
  if (d.type === 'none') return state; // identity keeps React from re-rendering on a stray mouseup

  const { sx, sy } = pos;
  const done = (s: BoardState): BoardState => ({ ...s, drag: { type: 'none' }, guides: [] });

  switch (d.type) {
    case 'edge': {
      const hit = findConnectorMagnet(toC(sx, sy, t), state.nodes, d.fromId, CONNECTOR_MAGNET);
      if (!hit) return done(state);
      const dup = state.edges.some(
        (ev) =>
          ev.fromId === d.fromId &&
          ev.toId === hit.node.id &&
          ev.fromSide === d.fromSide &&
          ev.toSide === hit.side,
      );
      if (dup) return done(state);
      return done({
        ...state,
        edges: [
          ...state.edges,
          {
            id: uid(),
            fromId: d.fromId,
            toId: hit.node.id,
            fromSide: d.fromSide,
            toSide: hit.side,
            points: [],
          },
        ],
      });
    }

    case 'draw': {
      const kind = state.tool === 'text' ? 'text' : state.tool === 'frame' ? 'frame' : 'box';
      const id = uid();
      const dx = Math.abs(sx - d.sx),
        dy = Math.abs(sy - d.sy);

      let x: number, y: number, w: number, h: number;
      if (dx < MIN_DRAW_PX && dy < MIN_DRAW_PX) {
        // Barely moved — treat as a click and drop a default-sized node centred on it.
        const c = toC(d.sx, d.sy, t);
        w = kind === 'frame' ? DEF_FRAME_W : DEF_W;
        h = kind === 'frame' ? DEF_FRAME_H : DEF_H;
        x = c.x - w / 2;
        y = c.y - h / 2;
      } else {
        const c1 = toC(Math.min(d.sx, sx), Math.min(d.sy, sy), t);
        const c2 = toC(Math.max(d.sx, sx), Math.max(d.sy, sy), t);
        x = c1.x;
        y = c1.y;
        w = Math.max(c2.x - c1.x, 60 / t.scale);
        h = Math.max(c2.y - c1.y, 28 / t.scale);
      }

      return done({
        ...state,
        nodes: [...state.nodes, mkNode(id, x, y, w, h, kind)],
        selected: [id],
        editing: id,
        tool: 'cursor',
      });
    }

    case 'pencil': {
      if (d.points.length < 2) return done(state);
      const id = uid();
      return done({
        ...state,
        nodes: [...state.nodes, mkDrawNode(id, d.points, state.penColor, state.penWidth)],
        selected: [id],
      });
    }

    // 'select' needs no work: DRAG_MOVE already kept `selected` in sync.
    default:
      return done(state);
  }
}

function onPaste(state: BoardState, at: XY | null, mode: PasteMode): BoardState {
  const clip = state.clipboard;
  if (!clip?.nodes.length) return state;

  const b = boundsOf(clip.nodes)!;
  const center = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
  // Land on the cursor when it's over the board, otherwise nudge off the original.
  const anchor = at ?? { x: center.x + 30, y: center.y + 30 };
  const dx = anchor.x - center.x,
    dy = anchor.y - center.y;

  // Вставка на ту же доску — всегда самостоятельный дубликат: связывать ноду с соседкой по
  // тому же холсту нечем, обе жили бы в одной папке и делили один файл.
  const linked = mode === 'link' && clip.boardId !== state.boardId;

  /** Первоисточник ноды: у связанной копии — тот, на кого она сама ссылается. */
  const originOf = (n: BNode): BoardNodeRef => n.link ?? { boardId: clip.boardId, nodeId: n.id };

  const idMap = new Map<string, string>();
  const newNodes = clip.nodes.map((n) => {
    const id = uid();
    idMap.set(n.id, id);
    const origin = originOf(n);
    return linked
      ? { ...n, id, x: n.x + dx, y: n.y + dy, link: origin, copiedFrom: undefined }
      : // Дубликат ни на что не ссылается, но помнит, откуда его содержимое, — зеркало
        // перенесёт текст файла в новый при его создании.
        { ...n, id, x: n.x + dx, y: n.y + dy, link: undefined, copiedFrom: origin };
  });
  const newEdges = clip.edges.map((ev) => ({
    ...ev,
    id: uid(),
    fromId: idMap.get(ev.fromId)!,
    toId: idMap.get(ev.toId)!,
    points: ev.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  }));

  return {
    ...state,
    nodes: [...state.nodes, ...newNodes],
    edges: [...state.edges, ...newEdges],
    selected: newNodes.map((n) => n.id),
    selectedEdge: null,
  };
}

/**
 * The board's whole state machine. `uid()` is the one impurity: ids are minted here rather
 * than threaded through every action, which is safe because nothing reads a node by identity
 * across dispatches.
 */
export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...initialBoardState,
        ready: true,
        boardId: action.boardId,
        nodes: action.nodes,
        edges: action.edges,
        settings: action.settings,
        view: action.view,
        penColor: state.penColor,
        penWidth: state.penWidth,
        tool: state.tool,
        clipboard: state.clipboard,
      };

    case 'SET_VIEW':
      return { ...state, view: action.view };

    case 'PAN_BY':
      return {
        ...state,
        view: { ...state.view, x: state.view.x + action.dx, y: state.view.y + action.dy },
      };

    case 'ZOOM_AT':
      return { ...state, view: zoomTo(state.view, action.factor, action.mx, action.my) };

    case 'FIT_VIEW': {
      const b = boundsOf(state.nodes);
      if (!b) return { ...state, view: DEF_VIEW };
      const w = b.x2 - b.x1 || 1,
        h = b.y2 - b.y1 || 1;
      const scale = clamp(
        Math.min((action.width - FIT_PADDING * 2) / w, (action.height - FIT_PADDING * 2) / h),
        MIN_S,
        FIT_MAX_SCALE,
      );
      return {
        ...state,
        view: {
          x: (action.width - w * scale) / 2 - b.x1 * scale,
          y: (action.height - h * scale) / 2 - b.y1 * scale,
          scale,
        },
      };
    }

    case 'FOCUS_NODE': {
      // Center the viewport on one node, fitting it with padding; never zooms past 1:1.
      const n = state.nodes.find((x) => x.id === action.id);
      if (!n) return state;
      const w = n.w || 1,
        h = n.h || 1;
      const scale = clamp(
        Math.min((action.width - FIT_PADDING * 2) / w, (action.height - FIT_PADDING * 2) / h),
        MIN_S,
        1,
      );
      return {
        ...state,
        view: {
          x: (action.width - w * scale) / 2 - n.x * scale,
          y: (action.height - h * scale) / 2 - n.y * scale,
          scale,
        },
      };
    }

    case 'SET_TOOL':
      return { ...state, tool: action.tool };

    case 'SELECT':
      return { ...state, selected: action.ids };

    case 'SELECT_EDGE':
      return { ...state, selectedEdge: action.id };

    case 'EDIT':
      return { ...state, editing: action.id };

    case 'ADD_NODE': {
      const id = uid();
      const node = mkNode(
        id,
        action.pos.x - DEF_W / 2,
        action.pos.y - DEF_H / 2,
        DEF_W,
        DEF_H,
        'box',
      );
      return { ...state, nodes: [...state.nodes, node], selected: [id], editing: id };
    }

    case 'SET_TEXT':
      return {
        ...state,
        nodes: mapNode(state.nodes, action.id, (n) => ({ ...n, text: action.text })),
      };

    case 'FONT_SIZE':
      return {
        ...state,
        nodes: mapNode(state.nodes, action.id, (n) => ({
          ...n,
          fontSize: clamp(n.fontSize + action.delta, 8, 72),
        })),
      };

    case 'SET_SHAPE':
      return {
        ...state,
        nodes: mapNode(state.nodes, action.id, (n) => ({
          ...n,
          shape: action.shape,
          h: action.shape === 'circle' ? n.w : n.h,
        })),
      };

    case 'SET_ALIGN':
      return {
        ...state,
        nodes: mapNode(state.nodes, action.id, (n) => ({ ...n, align: action.align })),
      };

    case 'STROKE_COLOR':
      return {
        ...state,
        nodes: mapNode(state.nodes, action.id, (n) => ({ ...n, color: action.color })),
      };

    case 'STROKE_WIDTH':
      return {
        ...state,
        nodes: mapNode(state.nodes, action.id, (n) => ({
          ...n,
          strokeW: clamp((n.strokeW ?? DEF_PEN_WIDTH) + action.delta, PEN_MIN_W, PEN_MAX_W),
        })),
      };

    case 'SET_PEN_COLOR':
      return { ...state, penColor: action.color };

    case 'PEN_WIDTH':
      return { ...state, penWidth: clamp(state.penWidth + action.delta, PEN_MIN_W, PEN_MAX_W) };

    case 'ADD_EDGE_BEND':
      return {
        ...state,
        edges: state.edges.map((ev) =>
          ev.id !== action.edgeId
            ? ev
            : {
                ...ev,
                points: [
                  ...ev.points.slice(0, action.index),
                  action.pt,
                  ...ev.points.slice(action.index),
                ],
              },
        ),
      };

    case 'DELETE_EDGE_POINT':
      return {
        ...state,
        edges: state.edges.map((ev) =>
          ev.id !== action.edgeId
            ? ev
            : {
                ...ev,
                points: ev.points.filter((_, i) => i !== action.index),
              },
        ),
      };

    case 'DELETE_SELECTION': {
      // A selected arrow wins over selected nodes — matches what the toolbar shows.
      if (state.selectedEdge) {
        return {
          ...state,
          edges: state.edges.filter((ev) => ev.id !== state.selectedEdge),
          selectedEdge: null,
        };
      }
      if (!state.selected.length) return state;
      const ids = new Set(state.selected);
      return {
        ...state,
        nodes: state.nodes.filter((n) => !ids.has(n.id)),
        edges: state.edges.filter((ev) => !ids.has(ev.fromId) && !ids.has(ev.toId)),
        selected: [],
      };
    }

    case 'COPY': {
      if (!state.selected.length || !state.boardId) return state;

      // Фрейм копируется вместе с содержимым — так же, как он вместе с ним перетаскивается.
      // Иначе связанная копия фрейма приезжала бы на другую доску пустой рамкой.
      const ids = new Set(state.selected);
      for (const n of state.nodes) {
        if (n.kind === 'frame' && ids.has(n.id)) {
          for (const inner of nodesInFrame(state.nodes, n)) ids.add(inner.id);
        }
      }

      return {
        ...state,
        clipboard: {
          boardId: state.boardId,
          nodes: state.nodes.filter((n) => ids.has(n.id)).map((n) => ({ ...n })),
          // Only edges wholly inside the selection — a dangling half-edge can't be pasted.
          edges: state.edges
            .filter((ev) => ids.has(ev.fromId) && ids.has(ev.toId))
            .map((ev) => ({ ...ev })),
        },
      };
    }

    case 'PASTE':
      return onPaste(state, action.at, action.mode);

    case 'UNLINK': {
      const texts = new Map(action.items.map((i) => [i.id, i.text]));
      if (!texts.size) return state;

      return {
        ...state,
        nodes: state.nodes.map((n) => {
          const text = texts.get(n.id);
          if (text === undefined || !n.link) return n;
          // Связь становится происхождением: зеркало заведёт ноде свой файл и перенесёт
          // в него текст оригинала — ровно как при вставке дубликатом.
          return { ...n, text, link: undefined, copiedFrom: n.link };
        }),
      };
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'DRAG_START':
      return { ...state, drag: action.drag, guides: [] };

    case 'DRAG_MOVE':
      return onDragMove(state, action.pos);

    case 'DRAG_END':
      return onDragEnd(state, action.pos);

    // Незавершённый жест ничего после себя не оставляет: начатая рамка выделения,
    // недорисованный штрих и тянущаяся стрелка просто исчезают. Уже применённые
    // перемещения при этом остаются — их DRAG_MOVE записал в узлы по ходу.
    case 'DRAG_CANCEL':
      return { ...state, drag: { type: 'none' }, guides: [] };

    default:
      return state;
  }
}
