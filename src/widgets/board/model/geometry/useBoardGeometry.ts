'use client';

import { useMemo } from 'react';
import {
  CONNECTOR_MAGNET,
  CONNECTOR_STANDOFF,
  EDGE_CORNER_RADIUS,
  MIN_DRAW_PX,
  edgeVerts,
  findConnectorMagnet,
  roundedPath,
  routeConnector,
  sidePoint,
  smoothPath,
  toC,
  toS,
  type BEdge,
  type BNode,
  type Side,
  type XY,
} from '@/entities/board';
import type { BoardState } from '../types';

export interface EdgeRender {
  id: string;
  edge: BEdge;
  /** Canvas-space vertices — what hit-testing a click on the arrow works against. */
  verts: XY[];
  screenVerts: XY[];
  d: string;
}

export interface ScreenRect {
  left: number;
  top: number;
  w: number;
  h: number;
}

/** A smart-alignment line projected to screen space: 'x' is vertical (uses `length` as height). */
export interface ScreenGuide {
  axis: 'x' | 'y';
  x: number;
  y: number;
  length: number;
}

export interface BoardGeometry {
  arrows: EdgeRender[];
  /** Dashed preview of the arrow currently being dragged out of a connector. */
  previewPath: string | null;
  /** Node + side the dragged arrow would snap to, so the target can light up. */
  dropTargetId: string | null;
  dropTargetSide: Side | null;
  drawPreview: ScreenRect | null;
  selectRect: ScreenRect | null;
  pencilPath: string | null;
  /** Anchor for the single-node property bar, in screen coords. */
  propsAnchor: XY | null;
  multiAnchor: XY | null;
  edgeActionAnchor: XY | null;
  selectedNode: BNode | null;
  guides: ScreenGuide[];
}

/** Screen-space rect spanned by a drag, or null while it's still below the given threshold. */
function dragRect(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  minPx: number,
): ScreenRect | null {
  const w = Math.abs(ex - sx),
    h = Math.abs(ey - sy);
  if (w < minPx && h < minPx) return null;
  return { left: Math.min(sx, ex), top: Math.min(sy, ey), w, h };
}

const SELECT_THRESHOLD_PX = 4;

export function useBoardGeometry(state: BoardState): BoardGeometry {
  const { nodes, edges, view, drag, selected, selectedEdge, editing } = state;

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Routing is the expensive part (rect-intersection tests per edge), and it only depends on
  // where the nodes are — so panning and zooming reuse it and just re-project below.
  const routed = useMemo(
    () =>
      edges.flatMap((edge) => {
        const from = byId.get(edge.fromId);
        const to = byId.get(edge.toId);
        if (!from || !to) return [];
        return [{ edge, verts: edgeVerts(from, to, edge) }];
      }),
    [edges, byId],
  );

  const arrows = useMemo<EdgeRender[]>(
    () =>
      routed.map(({ edge, verts }) => {
        const screenVerts = verts.map((v) => toS(v.x, v.y, view));
        return {
          id: edge.id,
          edge,
          verts,
          screenVerts,
          d: roundedPath(screenVerts, EDGE_CORNER_RADIUS),
        };
      }),
    [routed, view],
  );

  const edgePreview = useMemo(() => {
    if (drag.type !== 'edge')
      return { previewPath: null, dropTargetId: null, dropTargetSide: null };
    const from = byId.get(drag.fromId);
    if (!from) return { previewPath: null, dropTargetId: null, dropTargetSide: null };

    const magnet = findConnectorMagnet(
      toC(drag.toSX, drag.toSY, view),
      nodes,
      drag.fromId,
      CONNECTOR_MAGNET,
    );
    if (!magnet) {
      // No target in range — rubber-band straight from the connector to the cursor.
      const fp = toS(sidePoint(from, drag.fromSide).x, sidePoint(from, drag.fromSide).y, view);
      return {
        previewPath: `M ${fp.x} ${fp.y} L ${drag.toSX} ${drag.toSY}`,
        dropTargetId: null,
        dropTargetSide: null,
      };
    }

    const verts = routeConnector(from, drag.fromSide, magnet.node, magnet.side);
    return {
      previewPath: roundedPath(
        verts.map((v) => toS(v.x, v.y, view)),
        EDGE_CORNER_RADIUS,
      ),
      dropTargetId: magnet.node.id,
      dropTargetSide: magnet.side,
    };
  }, [drag, nodes, byId, view]);

  const drawPreview =
    drag.type === 'draw' ? dragRect(drag.sx, drag.sy, drag.ex, drag.ey, MIN_DRAW_PX) : null;

  const selectRect =
    drag.type === 'select'
      ? dragRect(drag.sx, drag.sy, drag.ex, drag.ey, SELECT_THRESHOLD_PX + 1)
      : null;

  const pencilPath = useMemo(
    () => (drag.type === 'pencil' ? smoothPath(drag.points.map((p) => toS(p.x, p.y, view))) : null),
    [drag, view],
  );

  const idle = drag.type === 'none';
  const selectedNode = selected.length === 1 ? (byId.get(selected[0]) ?? null) : null;

  /**
   * A selected node shows its north connector CONNECTOR_STANDOFF canvas-px above its top edge.
   * The property bar is positioned in *screen* space and outranks the connector on z-index, so
   * without this clearance it covers the connector and the north arrow can't be grabbed.
   * Draw nodes have no connectors, hence no clearance.
   */
  const hasConnectors = (n: BNode) => n.kind !== 'draw' && n.kind !== 'frame';
  const barClearance = (nodes: BNode[]) =>
    nodes.some(hasConnectors) ? CONNECTOR_STANDOFF * view.scale : 0;

  // Bars hide during a drag: they'd fight the cursor and lag a frame behind the thing they label.
  const propsAnchor =
    selectedNode && !editing && idle
      ? (() => {
          const s = toS(selectedNode.x + selectedNode.w / 2, selectedNode.y, view);
          return { x: s.x, y: s.y - barClearance([selectedNode]) };
        })()
      : null;

  const multiAnchor = useMemo(() => {
    if (selected.length <= 1 || !idle) return null;
    const sel = selected.map((id) => byId.get(id)).filter((n): n is BNode => !!n);
    if (!sel.length) return null;
    const minX = Math.min(...sel.map((n) => n.x));
    const maxX = Math.max(...sel.map((n) => n.x + n.w));
    const minY = Math.min(...sel.map((n) => n.y));
    const s = toS((minX + maxX) / 2, minY, view);
    const clearance = sel.some((n) => n.kind !== 'draw' && n.kind !== 'frame')
      ? CONNECTOR_STANDOFF * view.scale
      : 0;
    return { x: s.x, y: s.y - clearance };
  }, [selected, byId, idle, view]);

  const edgeActionAnchor = useMemo(() => {
    if (!selectedEdge || !idle) return null;
    const found = arrows.find((a) => a.id === selectedEdge);
    return found ? found.screenVerts[Math.floor(found.screenVerts.length / 2)] : null;
  }, [selectedEdge, idle, arrows]);

  const guides = useMemo<ScreenGuide[]>(
    () =>
      state.guides.map((g) => {
        if (g.axis === 'x') {
          const a = toS(g.pos, g.start, view),
            b = toS(g.pos, g.end, view);
          return { axis: 'x', x: a.x, y: Math.min(a.y, b.y), length: Math.abs(b.y - a.y) };
        }
        const a = toS(g.start, g.pos, view),
          b = toS(g.end, g.pos, view);
        return { axis: 'y', x: Math.min(a.x, b.x), y: a.y, length: Math.abs(b.x - a.x) };
      }),
    [state.guides, view],
  );

  return {
    arrows,
    ...edgePreview,
    drawPreview,
    selectRect,
    pencilPath,
    propsAnchor,
    multiAnchor,
    edgeActionAnchor,
    selectedNode,
    guides,
  };
}

/** Cursor for the viewport, which changes with both the active tool and the live drag. */
export function viewportCursor(state: BoardState, spacePan: boolean): string {
  if (state.drag.type === 'pan') return 'grabbing';
  if (spacePan || state.tool === 'hand') return 'grab';
  if (state.drag.type === 'edge' || state.drag.type === 'draw' || state.tool !== 'cursor')
    return 'crosshair';
  return 'default';
}
