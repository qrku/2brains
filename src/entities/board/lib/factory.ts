import type { BNode, NodeKind, XY } from '../model/types';
import { MIN_STROKE_DIM } from '../model/constants';

export function mkNode(id: string, x: number, y: number, w: number, h: number, kind: NodeKind): BNode {
  return { id, x, y, w, h, text: '', kind, fontSize: kind === 'text' ? 16 : 13, shape: 'rect' };
}

/** Turn raw captured canvas-space points into a `draw` node: bounding box + normalized (0..1) points. */
export function mkDrawNode(id: string, rawPoints: XY[], color: string, strokeW: number): BNode {
  const xs = rawPoints.map((p) => p.x), ys = rawPoints.map((p) => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);

  // A perfectly straight stroke has zero extent on one axis — pad it so the node stays grabbable.
  const padX = Math.max(0, MIN_STROKE_DIM - (maxX - minX)) / 2;
  const padY = Math.max(0, MIN_STROKE_DIM - (maxY - minY)) / 2;
  minX -= padX; maxX += padX;
  minY -= padY; maxY += padY;

  const w = maxX - minX, h = maxY - minY;
  const points = rawPoints.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));

  return { id, x: minX, y: minY, w, h, text: '', kind: 'draw', fontSize: 13, shape: 'rect', points, color, strokeW };
}

/** Points of a `draw` node scaled back out of 0..1 into its own box. */
export function drawNodePoints(node: BNode): XY[] {
  return (node.points ?? []).map((p) => ({ x: p.x * node.w, y: p.y * node.h }));
}
