import type { BEdge, BNode, Side, XY } from '../model/types';
import { EDGE_DETOUR } from '../model/constants';
import {
  axisOf,
  borderPt,
  pathHitsRect,
  pathLen,
  postPoint,
  rectOf,
  sidePoint,
  unionRect,
} from './geometry';

/** The plain L- or Z-elbow between two connector posts, ignoring obstacles. */
function directElbow(post1: XY, fromSide: Side, post2: XY, toSide: Side): XY[] {
  const aFrom = axisOf(fromSide),
    aTo = axisOf(toSide);

  if (aFrom !== aTo) {
    const bend = aFrom === 'h' ? { x: post2.x, y: post1.y } : { x: post1.x, y: post2.y };
    return [post1, bend, post2];
  }
  if (aFrom === 'h') {
    const midX = (post1.x + post2.x) / 2;
    return [post1, { x: midX, y: post1.y }, { x: midX, y: post2.y }, post2];
  }
  const midY = (post1.y + post2.y) / 2;
  return [post1, { x: post1.x, y: midY }, { x: post2.x, y: midY }, post2];
}

/**
 * Route between two connector points, swinging around either block's rect if the
 * direct elbow would cut across it. Picks the shortest of four detour lanes
 * (above / below / left / right of both blocks' union).
 */
export function routeConnector(from: BNode, fromSide: Side, to: BNode, toSide: Side): XY[] {
  const exit = sidePoint(from, fromSide);
  const entry = sidePoint(to, toSide);
  const post1 = postPoint(from, fromSide);
  const post2 = postPoint(to, toSide);
  const rFrom = rectOf(from),
    rTo = rectOf(to);

  const directPts = [exit, ...directElbow(post1, fromSide, post2, toSide), entry];
  if (!pathHitsRect(directPts, rFrom) && !pathHitsRect(directPts, rTo)) return directPts;

  const u = unionRect(rFrom, rTo);
  const lanes: [XY, XY][] = [
    [
      { x: post1.x, y: u.y1 - EDGE_DETOUR },
      { x: post2.x, y: u.y1 - EDGE_DETOUR },
    ], // top
    [
      { x: post1.x, y: u.y2 + EDGE_DETOUR },
      { x: post2.x, y: u.y2 + EDGE_DETOUR },
    ], // bottom
    [
      { x: u.x1 - EDGE_DETOUR, y: post1.y },
      { x: u.x1 - EDGE_DETOUR, y: post2.y },
    ], // left
    [
      { x: u.x2 + EDGE_DETOUR, y: post1.y },
      { x: u.x2 + EDGE_DETOUR, y: post2.y },
    ], // right
  ];

  let best: { pts: XY[]; len: number } | null = null;
  for (const [b1, b2] of lanes) {
    const pts = [exit, post1, b1, b2, post2, entry];
    if (pathHitsRect(pts, rFrom) || pathHitsRect(pts, rTo)) continue;
    const len = pathLen(pts);
    if (!best || len < best.len) best = { pts, len };
  }
  return best ? best.pts : directPts;
}

/**
 * Vertices of an edge in canvas space. An edge with no manual bend points and both
 * sides pinned is auto-routed; otherwise it runs straight through its bend points.
 */
export function edgeVerts(from: BNode, to: BNode, edge: BEdge): XY[] {
  if (edge.points.length === 0 && edge.fromSide && edge.toSide) {
    return routeConnector(from, edge.fromSide, to, edge.toSide);
  }

  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const firstTarget = edge.points[0] ?? tc;
  const lastTarget = edge.points[edge.points.length - 1] ?? fc;

  const start = edge.fromSide ? sidePoint(from, edge.fromSide) : borderPt(from, firstTarget);
  const end = edge.toSide ? sidePoint(to, edge.toSide) : borderPt(to, lastTarget);
  return [start, ...edge.points, end];
}
