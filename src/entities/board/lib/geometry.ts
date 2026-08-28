import type { BNode, Rect, Side, T, XY } from '../model/types';
import { CONNECTOR_STANDOFF, MAX_S, MIN_S } from '../model/constants';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Screen → canvas. */
export function toC(sx: number, sy: number, t: T): XY {
  return { x: (sx - t.x) / t.scale, y: (sy - t.y) / t.scale };
}
/** Canvas → screen. */
export function toS(cx: number, cy: number, t: T): XY {
  return { x: cx * t.scale + t.x, y: cy * t.scale + t.y };
}

/** Zoom by `factor`, keeping the point (mx,my) — in screen coords — pinned. */
export function zoomTo(t: T, factor: number, mx: number, my: number): T {
  const ns = clamp(t.scale * factor, MIN_S, MAX_S);
  return {
    x: mx - (mx - t.x) * (ns / t.scale),
    y: my - (my - t.y) * (ns / t.scale),
    scale: ns,
  };
}

/** Where a ray from the node's centre toward `toward` crosses the node border. */
export function borderPt(n: BNode, toward: XY): XY {
  const cx = n.x + n.w / 2,
    cy = n.y + n.h / 2;
  const dx = toward.x - cx,
    dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const s = Math.min(
    dx ? Math.abs(n.w / 2 / dx) : Infinity,
    dy ? Math.abs(n.h / 2 / dy) : Infinity,
  );
  return { x: cx + dx * s, y: cy + dy * s };
}

/** Midpoint of one of the node's four sides. */
export function sidePoint(n: BNode, side: Side): XY {
  const cx = n.x + n.w / 2,
    cy = n.y + n.h / 2;
  switch (side) {
    case 'n':
      return { x: cx, y: n.y };
    case 's':
      return { x: cx, y: n.y + n.h };
    case 'e':
      return { x: n.x + n.w, y: cy };
    case 'w':
      return { x: n.x, y: cy };
  }
}

/** The connector "post" — a point standing off the side, where arrows start and end. */
export function postPoint(n: BNode, side: Side): XY {
  const p = sidePoint(n, side);
  switch (side) {
    case 'n':
      return { x: p.x, y: p.y - CONNECTOR_STANDOFF };
    case 's':
      return { x: p.x, y: p.y + CONNECTOR_STANDOFF };
    case 'e':
      return { x: p.x + CONNECTOR_STANDOFF, y: p.y };
    case 'w':
      return { x: p.x - CONNECTOR_STANDOFF, y: p.y };
  }
}

export function axisOf(side: Side): 'h' | 'v' {
  return side === 'e' || side === 'w' ? 'h' : 'v';
}

export function rectOf(n: BNode): Rect {
  return { x1: n.x, y1: n.y, x2: n.x + n.w, y2: n.y + n.h };
}

export function unionRect(a: Rect, b: Rect): Rect {
  return {
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
    x2: Math.max(a.x2, b.x2),
    y2: Math.max(a.y2, b.y2),
  };
}

export function pointInRect(p: XY, r: Rect): boolean {
  return p.x > r.x1 && p.x < r.x2 && p.y > r.y1 && p.y < r.y2;
}

function ccw(a: XY, b: XY, c: XY): boolean {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function segSegIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

export function segRectIntersect(a: XY, b: XY, r: Rect): boolean {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const edges: [XY, XY][] = [
    [
      { x: r.x1, y: r.y1 },
      { x: r.x2, y: r.y1 },
    ],
    [
      { x: r.x2, y: r.y1 },
      { x: r.x2, y: r.y2 },
    ],
    [
      { x: r.x2, y: r.y2 },
      { x: r.x1, y: r.y2 },
    ],
    [
      { x: r.x1, y: r.y2 },
      { x: r.x1, y: r.y1 },
    ],
  ];
  return edges.some(([c, d]) => segSegIntersect(a, b, c, d));
}

export function pathHitsRect(pts: XY[], r: Rect): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    if (segRectIntersect(pts[i], pts[i + 1], r)) return true;
  }
  return false;
}

export function pathLen(pts: XY[]): number {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    s += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return s;
}

export function distToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

export function nodeConnectors(n: BNode): { side: Side; pt: XY }[] {
  return (['n', 's', 'e', 'w'] as const).map((side) => ({ side, pt: postPoint(n, side) }));
}

/** Nearest connector post within `radius` of `pos`, ignoring the node the arrow started from. */
export function findConnectorMagnet(
  pos: XY,
  nodes: BNode[],
  excludeId: string,
  radius: number,
): { node: BNode; side: Side; pt: XY } | null {
  let best: { node: BNode; side: Side; pt: XY; d: number } | null = null;
  for (const n of nodes) {
    if (n.id === excludeId || n.kind === 'frame') continue;
    for (const c of nodeConnectors(n)) {
      const d = Math.hypot(pos.x - c.pt.x, pos.y - c.pt.y);
      if (d <= radius && (!best || d < best.d)) best = { node: n, side: c.side, pt: c.pt, d };
    }
  }
  return best ? { node: best.node, side: best.side, pt: best.pt } : null;
}

/** Nodes intersecting the canvas-space rect spanned by two corners. */
export function nodesInRect(nodes: BNode[], c1: XY, c2: XY): BNode[] {
  const x1 = Math.min(c1.x, c2.x),
    x2 = Math.max(c1.x, c2.x);
  const y1 = Math.min(c1.y, c2.y),
    y2 = Math.max(c1.y, c2.y);
  return nodes.filter((n) => n.x + n.w > x1 && n.x < x2 && n.y + n.h > y1 && n.y < y2);
}

/** Whether a node counts as living inside a frame: its centre lies within the frame's box. */
function insideFrame(node: BNode, frame: BNode): boolean {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  return (
    node.id !== frame.id &&
    node.kind !== 'frame' &&
    cx > frame.x &&
    cx < frame.x + frame.w &&
    cy > frame.y &&
    cy < frame.y + frame.h
  );
}

/** A frame's logical contents: non-frame nodes whose centre lies inside its box. */
export function nodesInFrame(nodes: BNode[], frame: BNode): BNode[] {
  return nodes.filter((n) => insideFrame(n, frame));
}

/**
 * The frame a node belongs to, or null when it sits on the bare canvas.
 *
 * Frames may overlap, so containment alone is ambiguous; the smallest containing frame wins,
 * which reads as "the innermost one". Equal areas fall back to board order, so the answer is
 * stable across renders — the file tree mirrors it, and a flapping answer would move files.
 */
export function frameOf(nodes: BNode[], node: BNode): BNode | null {
  let best: BNode | null = null;
  let bestArea = Infinity;
  for (const f of nodes) {
    if (f.kind !== 'frame' || !insideFrame(node, f)) continue;
    const area = f.w * f.h;
    if (area < bestArea) {
      best = f;
      bestArea = area;
    }
  }
  return best;
}

/** Bounding box of a set of nodes; null when empty. */
export function boundsOf(nodes: BNode[]): Rect | null {
  if (!nodes.length) return null;
  return {
    x1: Math.min(...nodes.map((n) => n.x)),
    y1: Math.min(...nodes.map((n) => n.y)),
    x2: Math.max(...nodes.map((n) => n.x + n.w)),
    y2: Math.max(...nodes.map((n) => n.y + n.h)),
  };
}
