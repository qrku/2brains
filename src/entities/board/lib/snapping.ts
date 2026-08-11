import type { BNode, Rect } from '../model/types';

/** A smart-alignment line shown while dragging: canvas-space, either vertical ('x') or horizontal ('y'). */
export interface Guide {
  axis: 'x' | 'y';
  pos: number; // the line's coordinate on its axis (x for vertical, y for horizontal)
  start: number; // extent along the perpendicular axis
  end: number;
}

export interface SnapResult {
  /** Correction to add to the drag delta so the aligned edges/centres coincide exactly. */
  snapX: number;
  snapY: number;
  guides: Guide[];
}

/** Two coordinates are "the same line" below this (canvas units) when merging guide spans. */
const SNAP_EPS = 0.5;

interface Best {
  delta: number;
  dist: number;
}

/** The three snap references of a box on one axis: near edge, centre, far edge. */
function refs(lo: number, size: number): [number, number, number] {
  return [lo, lo + size / 2, lo + size];
}

function bestMatch(
  mv: number[],
  target: number[],
  threshold: number,
  prev: Best | null,
): Best | null {
  let best = prev;
  for (const m of mv) {
    for (const t of target) {
      const dist = Math.abs(m - t);
      if (dist <= threshold && (!best || dist < best.dist)) best = { delta: t - m, dist };
    }
  }
  return best;
}

/**
 * Every guide line for one axis after the snap is applied: any static ref the (snapped) moving box
 * now shares gets a line, spanning both boxes — so matching two nodes of equal height shows both the
 * top and bottom lines at once.
 */
function collectGuides(
  axis: 'x' | 'y',
  mvRefs: number[],
  perpMin: number,
  perpMax: number,
  statics: BNode[],
  out: Guide[],
): void {
  const byPos = new Map<number, { start: number; end: number }>();
  for (const s of statics) {
    const sRefs = axis === 'x' ? refs(s.x, s.w) : refs(s.y, s.h);
    const sMin = axis === 'x' ? s.y : s.x;
    const sMax = axis === 'x' ? s.y + s.h : s.x + s.w;
    for (const sr of sRefs) {
      if (!mvRefs.some((m) => Math.abs(m - sr) < SNAP_EPS)) continue;
      const key = Math.round(sr * 100) / 100;
      const span = byPos.get(key) ?? { start: perpMin, end: perpMax };
      span.start = Math.min(span.start, sMin);
      span.end = Math.max(span.end, sMax);
      byPos.set(key, span);
    }
  }
  for (const [pos, span] of byPos) out.push({ axis, pos, start: span.start, end: span.end });
}

/**
 * Figma-style alignment snap: match the moving box's edges/centres against the static nodes on each
 * axis independently, pick the closest within `threshold`, and return both the corrective delta and
 * the guide lines to draw. Empty result (zero deltas, no guides) when nothing is in range.
 */
export function computeSnap(mv: Rect, statics: BNode[], threshold: number): SnapResult {
  const mvXs = refs(mv.x1, mv.x2 - mv.x1);
  const mvYs = refs(mv.y1, mv.y2 - mv.y1);

  let bestX: Best | null = null;
  let bestY: Best | null = null;
  for (const s of statics) {
    bestX = bestMatch(mvXs, refs(s.x, s.w), threshold, bestX);
    bestY = bestMatch(mvYs, refs(s.y, s.h), threshold, bestY);
  }

  const snapX = bestX?.delta ?? 0;
  const snapY = bestY?.delta ?? 0;
  const sm: Rect = { x1: mv.x1 + snapX, y1: mv.y1 + snapY, x2: mv.x2 + snapX, y2: mv.y2 + snapY };

  const guides: Guide[] = [];
  if (bestX) collectGuides('x', refs(sm.x1, sm.x2 - sm.x1), sm.y1, sm.y2, statics, guides);
  if (bestY) collectGuides('y', refs(sm.y1, sm.y2 - sm.y1), sm.x1, sm.x2, statics, guides);

  return { snapX, snapY, guides };
}

export interface ResizeSnapResult {
  /** Correction to add to the resize drag delta so the moving edge lands on the aligned line. */
  ddx: number;
  ddy: number;
  /** Whether an X / Y snap occurred — used to decide which guides to draw for the final box. */
  alignX: boolean;
  alignY: boolean;
}

/**
 * Alignment snap for a resize: only the edges the handle actually moves (n/s/e/w) are matched
 * against the static nodes' edges/centres, so the dragged side clicks onto the closest line
 * within `threshold`. Returns the corrective delta; guide lines come from {@link resizeGuides}
 * once the caller has produced the final (shape-aware) box.
 */
export function computeResizeSnap(
  o: { x: number; y: number; w: number; h: number },
  edge: string,
  dx: number,
  dy: number,
  statics: BNode[],
  threshold: number,
): ResizeSnapResult {
  const mvX: number[] = [];
  if (edge.includes('e')) mvX.push(o.x + o.w + dx);
  if (edge.includes('w')) mvX.push(o.x + dx);
  const mvY: number[] = [];
  if (edge.includes('s')) mvY.push(o.y + o.h + dy);
  if (edge.includes('n')) mvY.push(o.y + dy);

  let bestX: Best | null = null;
  let bestY: Best | null = null;
  for (const s of statics) {
    if (mvX.length) bestX = bestMatch(mvX, refs(s.x, s.w), threshold, bestX);
    if (mvY.length) bestY = bestMatch(mvY, refs(s.y, s.h), threshold, bestY);
  }

  return { ddx: bestX?.delta ?? 0, ddy: bestY?.delta ?? 0, alignX: !!bestX, alignY: !!bestY };
}

/** Guide lines for a resized box: driven off the box's actual (post-snap) bounds so circles line up too. */
export function resizeGuides(
  box: Rect,
  statics: BNode[],
  alignX: boolean,
  alignY: boolean,
): Guide[] {
  const guides: Guide[] = [];
  if (alignX) collectGuides('x', refs(box.x1, box.x2 - box.x1), box.y1, box.y2, statics, guides);
  if (alignY) collectGuides('y', refs(box.y1, box.y2 - box.y1), box.x1, box.x2, statics, guides);
  return guides;
}
