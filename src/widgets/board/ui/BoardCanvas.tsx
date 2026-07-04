'use client';

import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { parseMarkdown } from '@/shared/lib/markdown';
import { spaceReadContent } from '@/app/providers/SpaceStoreProvider';
import { Icon, type IconName } from '@/shared/ui/Icon';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type NodeKind  = 'box' | 'text' | 'draw';
type NodeShape = 'rect' | 'diamond' | 'circle';

interface BNode {
  id: string; x: number; y: number;
  w: number; h: number;
  text: string;
  kind: NodeKind;
  fontSize: number;
  shape: NodeShape;
  points?: XY[];   // kind === 'draw': freehand stroke, normalized to 0..1 within the node's own box
  color?: string;  // kind === 'draw'
  strokeW?: number; // kind === 'draw'
}
interface BEdge { id: string; fromId: string; toId: string; fromSide?: Side; toSide?: Side; points: XY[]; }
interface XY    { x: number; y: number; }
interface T     { x: number; y: number; scale: number; }

interface BoardSettings {
  edgePan: boolean;
  edgePanThreshold: number;
  edgePanSpeed: number;
}

type Tool = 'cursor' | 'hand' | 'box' | 'text' | 'pencil';
type Side = 'n' | 's' | 'e' | 'w';
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type Drag =
  | { type: 'none' }
  | { type: 'pan';    startX: number; startY: number; ox: number; oy: number }
  | { type: 'nodes';  ids: string[]; startX: number; startY: number; origins: Record<string, XY> }
  | { type: 'select'; sx: number; sy: number; ex: number; ey: number }
  | { type: 'edge';   fromId: string; fromSide: Side; toSX: number; toSY: number }
  | { type: 'draw';   sx: number; sy: number; ex: number; ey: number }
  | { type: 'pencil'; points: XY[] }
  | { type: 'resize'; id: string; edge: ResizeEdge; startX: number; startY: number; origin: { x: number; y: number; w: number; h: number } }
  | { type: 'edgePoint'; edgeId: string; index: number; startX: number; startY: number; origin: XY };

/* ─── Constants ─────────────────────────────────────────────────────────── */
const DEF_W = 160, DEF_H = 80;
const MIN_DRAW_PX = 10;
const MIN_S = 0.08, MAX_S = 4;
const KEY          = 'board_data_v1';
const SETTINGS_KEY = 'board_settings_v1';
const VIEW_KEY      = 'board_view_v1';
const DEF_SETTINGS: BoardSettings = { edgePan: true, edgePanThreshold: 80, edgePanSpeed: 6 };
const DEF_VIEW: T = { x: 0, y: 0, scale: 1 };
const CONNECTOR_STANDOFF = 30; // must match .bh-n/s/e/w offset in globals.css
const CONNECTOR_MAGNET   = 28;
const MIN_STROKE_DIM = 8;
const PEN_MIN_W = 1, PEN_MAX_W = 14;
const DEF_PEN_COLOR = '#1c1c1e', DEF_PEN_WIDTH = 3;

/* ─── Tools / shapes ─────────────────────────────────────────────────────── */
const TOOL_ICONS: Record<Tool, IconName> = {
  hand:   'hand',
  cursor: 'navigation',
  box:    'draw',
  text:   'text-1',
  pencil: 'edit-01',
};
function ToolIcon({ id }: { id: Tool }) {
  return <Icon name={TOOL_ICONS[id]} size={18} />;
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'hand',   label: 'Рука'     },
  { id: 'cursor', label: 'Курсор'   },
  { id: 'box',    label: 'Блок'     },
  { id: 'text',   label: 'Текст'    },
  { id: 'pencil', label: 'Карандаш' },
];

const SHAPES: { id: NodeShape; icon: string; label: string }[] = [
  { id: 'rect',    icon: '▭', label: 'Прямоугольник' },
  { id: 'diamond', icon: '◇', label: 'Ромб'           },
  { id: 'circle',  icon: '○', label: 'Круг'           },
];

const DRAW_COLORS = ['#1c1c1e', '#e0433d', '#2f6fed', '#1f9e5c', '#f0a020', '#8b5cf6'];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const uid  = () => Math.random().toString(36).slice(2, 9);
const clmp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadData(): { nodes: BNode[]; edges: BEdge[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw) return { nodes: [], edges: [] };
    return {
      nodes: (raw.nodes ?? []).map((n: any) => ({
        kind: 'box', fontSize: 13, shape: 'rect', w: DEF_W, h: DEF_H, ...n,
      })),
      edges: (raw.edges ?? []).map((e: any) => ({ points: [], ...e })),
    };
  } catch { return { nodes: [], edges: [] }; }
}
function saveData(d: { nodes: BNode[]; edges: BEdge[] }) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
}
function loadSettings(): BoardSettings {
  try { return { ...DEF_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; }
  catch { return DEF_SETTINGS; }
}
function saveSettings(s: BoardSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}
function loadView(): T {
  try { return { ...DEF_VIEW, ...JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') }; }
  catch { return DEF_VIEW; }
}
function saveView(t: T) {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(t)); } catch {}
}

function toC(sx: number, sy: number, t: T): XY { return { x: (sx - t.x) / t.scale, y: (sy - t.y) / t.scale }; }
function toS(cx: number, cy: number, t: T): XY { return { x: cx * t.scale + t.x, y: cy * t.scale + t.y }; }

function borderPt(n: BNode, toward: XY): XY {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  const dx = toward.x - cx, dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const s = Math.min(dx ? Math.abs(n.w / 2 / dx) : Infinity, dy ? Math.abs(n.h / 2 / dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s };
}

function zoomTo(t: T, factor: number, mx: number, my: number): T {
  const ns = clmp(t.scale * factor, MIN_S, MAX_S);
  return { x: mx - (mx - t.x) * (ns / t.scale), y: my - (my - t.y) * (ns / t.scale), scale: ns };
}

function mkNode(id: string, x: number, y: number, w: number, h: number, kind: NodeKind): BNode {
  return { id, x, y, w, h, text: '', kind, fontSize: kind === 'text' ? 16 : 13, shape: 'rect' };
}

/** Turn raw captured canvas-space points into a `draw` node: bounding box + normalized (0..1) points. */
function mkDrawNode(id: string, rawPoints: XY[], color: string, strokeW: number): BNode {
  const xs = rawPoints.map((p) => p.x), ys = rawPoints.map((p) => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const padX = Math.max(0, MIN_STROKE_DIM - (maxX - minX)) / 2;
  const padY = Math.max(0, MIN_STROKE_DIM - (maxY - minY)) / 2;
  minX -= padX; maxX += padX; minY -= padY; maxY += padY;
  const w = maxX - minX, h = maxY - minY;
  const points = rawPoints.map((p) => ({ x: (p.x - minX) / w, y: (p.y - minY) / h }));
  return { id, x: minX, y: minY, w, h, text: '', kind: 'draw', fontSize: 13, shape: 'rect', points, color, strokeW };
}

function sidePoint(n: BNode, side: Side): XY {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
  switch (side) {
    case 'n': return { x: cx, y: n.y };
    case 's': return { x: cx, y: n.y + n.h };
    case 'e': return { x: n.x + n.w, y: cy };
    case 'w': return { x: n.x, y: cy };
  }
}

function postPoint(n: BNode, side: Side): XY {
  const p = sidePoint(n, side);
  switch (side) {
    case 'n': return { x: p.x, y: p.y - CONNECTOR_STANDOFF };
    case 's': return { x: p.x, y: p.y + CONNECTOR_STANDOFF };
    case 'e': return { x: p.x + CONNECTOR_STANDOFF, y: p.y };
    case 'w': return { x: p.x - CONNECTOR_STANDOFF, y: p.y };
  }
}

function axisOf(side: Side): 'h' | 'v' { return side === 'e' || side === 'w' ? 'h' : 'v'; }

/* ── Rectilinear routing: keeps auto-connected arrows from cutting across
   either endpoint's block, swinging around it once inside the magnet zone. ── */
const EDGE_DETOUR = 24;

interface Rect { x1: number; y1: number; x2: number; y2: number; }
function rectOf(n: BNode): Rect { return { x1: n.x, y1: n.y, x2: n.x + n.w, y2: n.y + n.h }; }
function unionRect(a: Rect, b: Rect): Rect {
  return { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) };
}
function pointInRect(p: XY, r: Rect): boolean { return p.x > r.x1 && p.x < r.x2 && p.y > r.y1 && p.y < r.y2; }
function ccw(a: XY, b: XY, c: XY): boolean { return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x); }
function segSegIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}
function segRectIntersect(a: XY, b: XY, r: Rect): boolean {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const edges: [XY, XY][] = [
    [{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y1 }],
    [{ x: r.x2, y: r.y1 }, { x: r.x2, y: r.y2 }],
    [{ x: r.x2, y: r.y2 }, { x: r.x1, y: r.y2 }],
    [{ x: r.x1, y: r.y2 }, { x: r.x1, y: r.y1 }],
  ];
  return edges.some(([c, d]) => segSegIntersect(a, b, c, d));
}
function pathHitsRect(pts: XY[], r: Rect): boolean {
  for (let i = 0; i < pts.length - 1; i++) if (segRectIntersect(pts[i], pts[i + 1], r)) return true;
  return false;
}
function pathLen(pts: XY[]): number {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return s;
}

function directElbow(post1: XY, fromSide: Side, post2: XY, toSide: Side): XY[] {
  const aFrom = axisOf(fromSide), aTo = axisOf(toSide);
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

/** Route between two connector points, swinging around either block's rect if the
 *  direct elbow would cut across it. */
function routeConnector(from: BNode, fromSide: Side, to: BNode, toSide: Side): XY[] {
  const exit = sidePoint(from, fromSide);
  const entry = sidePoint(to, toSide);
  const post1 = postPoint(from, fromSide);
  const post2 = postPoint(to, toSide);
  const rFrom = rectOf(from), rTo = rectOf(to);

  const directPts = [exit, ...directElbow(post1, fromSide, post2, toSide), entry];
  if (!pathHitsRect(directPts, rFrom) && !pathHitsRect(directPts, rTo)) return directPts;

  const u = unionRect(rFrom, rTo);
  const lanes: [XY, XY][] = [
    [{ x: post1.x, y: u.y1 - EDGE_DETOUR }, { x: post2.x, y: u.y1 - EDGE_DETOUR }], // top
    [{ x: post1.x, y: u.y2 + EDGE_DETOUR }, { x: post2.x, y: u.y2 + EDGE_DETOUR }], // bottom
    [{ x: u.x1 - EDGE_DETOUR, y: post1.y }, { x: u.x1 - EDGE_DETOUR, y: post2.y }], // left
    [{ x: u.x2 + EDGE_DETOUR, y: post1.y }, { x: u.x2 + EDGE_DETOUR, y: post2.y }], // right
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

function edgeVerts(from: BNode, to: BNode, edge: BEdge): XY[] {
  if (edge.points.length === 0 && edge.fromSide && edge.toSide) {
    return routeConnector(from, edge.fromSide, to, edge.toSide);
  }
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const firstTarget = edge.points[0] ?? tc;
  const lastTarget  = edge.points[edge.points.length - 1] ?? fc;
  const start = edge.fromSide ? sidePoint(from, edge.fromSide) : borderPt(from, firstTarget);
  const end   = edge.toSide   ? sidePoint(to, edge.toSide)     : borderPt(to, lastTarget);
  return [start, ...edge.points, end];
}

/** Smooth freehand stroke: quadratic-through-midpoints, the standard "pencil" smoothing trick. */
function smoothPath(points: XY[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    d += ` Q ${points[i].x} ${points[i].y} ${mid.x} ${mid.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

const EDGE_CORNER_RADIUS = 16;

function roundedPath(points: XY[], radius: number): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], cur = points[i], next = points[i + 1];
    const toPrev = { x: prev.x - cur.x, y: prev.y - cur.y };
    const toNext = { x: next.x - cur.x, y: next.y - cur.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y) || 1;
    const lenNext = Math.hypot(toNext.x, toNext.y) || 1;
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);
    const a = { x: cur.x + (toPrev.x / lenPrev) * r, y: cur.y + (toPrev.y / lenPrev) * r };
    const b = { x: cur.x + (toNext.x / lenNext) * r, y: cur.y + (toNext.y / lenNext) * r };
    d += ` L ${a.x} ${a.y} Q ${cur.x} ${cur.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function distToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const tt = lenSq ? clmp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + dx * tt), p.y - (a.y + dy * tt));
}

function nodeConnectors(n: BNode): { side: Side; pt: XY }[] {
  return (['n', 's', 'e', 'w'] as const).map((side) => ({ side, pt: postPoint(n, side) }));
}

function findConnectorMagnet(pos: XY, nodes: BNode[], excludeId: string, radius: number): { node: BNode; side: Side; pt: XY } | null {
  let best: { node: BNode; side: Side; pt: XY; d: number } | null = null;
  for (const n of nodes) {
    if (n.id === excludeId) continue;
    for (const c of nodeConnectors(n)) {
      const d = Math.hypot(pos.x - c.pt.x, pos.y - c.pt.y);
      if (d <= radius && (!best || d < best.d)) best = { node: n, side: c.side, pt: c.pt, d };
    }
  }
  return best ? { node: best.node, side: best.side, pt: best.pt } : null;
}

/* ─── BoardCanvas ────────────────────────────────────────────────────────── */
export function BoardCanvas() {
  const [nodes,       setNodes]       = useState<BNode[]>([]);
  const [edges,       setEdges]       = useState<BEdge[]>([]);
  const [tr,          setTr]          = useState<T>(DEF_VIEW);
  const [selected,    setSelected]    = useState<string[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [editing,     setEditing]     = useState<string | null>(null);
  const [drag,        setDrag]        = useState<Drag>({ type: 'none' });
  const [tool,        setTool]        = useState<Tool>('cursor');
  const [ready,       setReady]       = useState(false);
  const [settings,    setSettings]    = useState<BoardSettings>(DEF_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [spacePan,    setSpacePan]    = useState(false);
  const [notePanel,   setNotePanel]   = useState<{ id: string; name: string } | null>(null);
  const [penColor,    setPenColor]    = useState(DEF_PEN_COLOR);
  const [penWidth,    setPenWidth]    = useState(DEF_PEN_WIDTH);

  const vpRef       = useRef<HTMLDivElement>(null);
  const trRef       = useRef(tr);         trRef.current       = tr;
  const nodesRef    = useRef(nodes);      nodesRef.current    = nodes;
  const edgesRef    = useRef(edges);      edgesRef.current    = edges;
  const dragRef     = useRef(drag);       dragRef.current     = drag;
  const editingRef  = useRef(editing);    editingRef.current  = editing;
  const toolRef     = useRef(tool);       toolRef.current     = tool;
  const selectedRef = useRef(selected);   selectedRef.current = selected;
  const selectedEdgeRef = useRef(selectedEdge); selectedEdgeRef.current = selectedEdge;
  const settingsRef = useRef(settings);   settingsRef.current = settings;
  const penColorRef = useRef(penColor);   penColorRef.current = penColor;
  const penWidthRef = useRef(penWidth);   penWidthRef.current = penWidth;
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spaceRef    = useRef(false);
  const mouseRef    = useRef<XY>({ x: -1, y: -1 });
  const mouseInVp   = useRef(false);
  const mouseOnUi   = useRef(false);
  const clipboardRef = useRef<{ nodes: BNode[]; edges: BEdge[] } | null>(null);

  /* ── Load ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const d = loadData();
    setNodes(d.nodes); setEdges(d.edges);
    setSettings(loadSettings());
    setTr(loadView());
    setReady(true);
  }, []);

  /* ── Save ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData({ nodes, edges }), 500);
  }, [nodes, edges, ready]);

  /* ── Save view (pan/zoom) ────────────────────────────────────────── */
  useEffect(() => {
    if (!ready) return;
    if (viewSaveTimer.current) clearTimeout(viewSaveTimer.current);
    viewSaveTimer.current = setTimeout(() => saveView(tr), 300);
  }, [tr, ready]);

  /* ── Edge auto-pan (rAF) ─────────────────────────────────────────── */
  useEffect(() => {
    let raf: number;
    const loop = () => {
      const s  = settingsRef.current;
      const vp = vpRef.current;
      if (s.edgePan && vp && mouseInVp.current && !mouseOnUi.current) {
        const { width, height } = vp.getBoundingClientRect();
        const { x, y } = mouseRef.current;
        const thr   = s.edgePanThreshold;
        const speed = s.edgePanSpeed;
        let dx = 0, dy = 0;
        if (x >= 0 && x < thr)              dx =  speed * (1 - x / thr);
        if (x <= width && x > width - thr)  dx = -speed * (1 - (width - x) / thr);
        if (y >= 0 && y < thr)              dy =  speed * (1 - y / thr);
        if (y <= height && y > height - thr) dy = -speed * (1 - (height - y) / thr);
        if (dx || dy) setTr((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Global mouse ─────────────────────────────────────────────────── */
  useEffect(() => {
    const vpR = () => vpRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 };

    const onMove = (e: MouseEvent) => {
      const r = vpR();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };

      const d = dragRef.current, t = trRef.current;
      if (d.type === 'pan') {
        setTr({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY), scale: t.scale });
      } else if (d.type === 'nodes') {
        const dx = (e.clientX - d.startX) / t.scale;
        const dy = (e.clientY - d.startY) / t.scale;
        setNodes((ns) => ns.map((n) => {
          const o = d.origins[n.id];
          return o ? { ...n, x: o.x + dx, y: o.y + dy } : n;
        }));
      } else if (d.type === 'edge') {
        setDrag({ ...d, toSX: e.clientX - r.left, toSY: e.clientY - r.top });
      } else if (d.type === 'draw') {
        setDrag({ ...d, ex: e.clientX - r.left, ey: e.clientY - r.top });
      } else if (d.type === 'select') {
        const ex = e.clientX - r.left, ey = e.clientY - r.top;
        setDrag({ ...d, ex, ey });
        const dx = Math.abs(ex - d.sx), dy = Math.abs(ey - d.sy);
        if (dx > 4 || dy > 4) {
          const x1 = Math.min(d.sx, ex), y1 = Math.min(d.sy, ey);
          const x2 = Math.max(d.sx, ex), y2 = Math.max(d.sy, ey);
          const c1 = toC(x1, y1, t), c2 = toC(x2, y2, t);
          const hits = nodesRef.current.filter(
            (n) => n.x + n.w > c1.x && n.x < c2.x && n.y + n.h > c1.y && n.y < c2.y
          );
          setSelected(hits.map((n) => n.id));
        } else {
          setSelected([]);
        }
      } else if (d.type === 'resize') {
        const dx = (e.clientX - d.startX) / t.scale;
        const dy = (e.clientY - d.startY) / t.scale;
        const minW = 40 / t.scale, minH = 24 / t.scale;
        const o = d.origin;
        const hasN = d.edge.includes('n'), hasS = d.edge.includes('s');
        const hasE = d.edge.includes('e'), hasW = d.edge.includes('w');
        setNodes((ns) => ns.map((n) => {
          if (n.id !== d.id) return n;
          if (n.shape === 'circle') {
            const dH = hasE ? dx : hasW ? -dx : 0;
            const dV = hasS ? dy : hasN ? -dy : 0;
            const delta = (hasE || hasW) && (hasN || hasS) ? (dH + dV) / 2 : dH || dV;
            const size = Math.max(minW, o.w + delta);
            const x = hasW ? o.x + (o.w - size) : o.x;
            const y = hasN ? o.y + (o.h - size) : o.y;
            return { ...n, x, y, w: size, h: size };
          }
          let x = o.x, y = o.y, w = o.w, h = o.h;
          if (hasE) w = Math.max(minW, o.w + dx);
          if (hasW) { const nw = Math.max(minW, o.w - dx); x = o.x + (o.w - nw); w = nw; }
          if (hasS) h = Math.max(minH, o.h + dy);
          if (hasN) { const nh = Math.max(minH, o.h - dy); y = o.y + (o.h - nh); h = nh; }
          return { ...n, x, y, w, h };
        }));
      } else if (d.type === 'edgePoint') {
        const dx = (e.clientX - d.startX) / t.scale;
        const dy = (e.clientY - d.startY) / t.scale;
        setEdges((es) => es.map((ev) => ev.id === d.edgeId
          ? { ...ev, points: ev.points.map((p, i) => i === d.index ? { x: d.origin.x + dx, y: d.origin.y + dy } : p) }
          : ev));
      } else if (d.type === 'pencil') {
        const p = toC(e.clientX - r.left, e.clientY - r.top, t);
        const last = d.points[d.points.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 2 / t.scale) {
          setDrag({ ...d, points: [...d.points, p] });
        }
      }
    };

    const onUp = (e: MouseEvent) => {
      const d = dragRef.current, t = trRef.current;
      const r = vpR();

      if (d.type === 'edge') {
        const pos = toC(e.clientX - r.left, e.clientY - r.top, t);
        const hit = findConnectorMagnet(pos, nodesRef.current, d.fromId, CONNECTOR_MAGNET);
        if (hit) {
          setEdges((es) => {
            const dup = es.some((ev) =>
              ev.fromId === d.fromId && ev.toId === hit.node.id &&
              ev.fromSide === d.fromSide && ev.toSide === hit.side);
            if (dup) return es;
            return [...es, { id: uid(), fromId: d.fromId, toId: hit.node.id, fromSide: d.fromSide, toSide: hit.side, points: [] }];
          });
        }
      } else if (d.type === 'draw') {
        const dx = Math.abs(d.ex - d.sx), dy = Math.abs(d.ey - d.sy);
        const kind: NodeKind = toolRef.current === 'text' ? 'text' : 'box';
        const id = uid();
        let x: number, y: number, w: number, h: number;
        if (dx < MIN_DRAW_PX && dy < MIN_DRAW_PX) {
          const c = toC(d.sx, d.sy, t); w = DEF_W; h = DEF_H;
          x = c.x - w / 2; y = c.y - h / 2;
        } else {
          const c1 = toC(Math.min(d.sx, d.ex), Math.min(d.sy, d.ey), t);
          const c2 = toC(Math.max(d.sx, d.ex), Math.max(d.sy, d.ey), t);
          x = c1.x; y = c1.y;
          w = Math.max(c2.x - c1.x, 60 / t.scale);
          h = Math.max(c2.y - c1.y, 28 / t.scale);
        }
        setNodes((ns) => [...ns, mkNode(id, x, y, w, h, kind)]);
        setSelected([id]);
        setEditing(id);
        toolRef.current = 'cursor';
        setTool('cursor');
      } else if (d.type === 'select') {
        const dx = Math.abs(d.ex - d.sx), dy = Math.abs(d.ey - d.sy);
        if (dx > 4 || dy > 4) {
          const x1 = Math.min(d.sx, d.ex), y1 = Math.min(d.sy, d.ey);
          const x2 = Math.max(d.sx, d.ex), y2 = Math.max(d.sy, d.ey);
          const c1 = toC(x1, y1, t), c2 = toC(x2, y2, t);
          const hits = nodesRef.current.filter(
            (n) => n.x + n.w > c1.x && n.x < c2.x && n.y + n.h > c1.y && n.y < c2.y
          );
          setSelected(hits.map((n) => n.id));
        }
      } else if (d.type === 'pencil') {
        if (d.points.length >= 2) {
          const id = uid();
          setNodes((ns) => [...ns, mkDrawNode(id, d.points, penColorRef.current, penWidthRef.current)]);
          setSelected([id]);
        }
      }
      setDrag({ type: 'none' });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  /* ── Wheel (non-passive) ──────────────────────────────────────────── */
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const t = trRef.current, r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (e.ctrlKey || e.metaKey) {
        setTr(zoomTo(t, e.deltaY < 0 ? 1.05 : 0.95, mx, my));
      } else if (Math.abs(e.deltaX) > 1 || Math.abs(e.deltaY) < 50) {
        setTr({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY });
      } else {
        setTr(zoomTo(t, e.deltaY < 0 ? 1.15 : 1 / 1.15, mx, my));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  /* ── Keyboard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !editingRef.current) {
        e.preventDefault(); spaceRef.current = true; setSpacePan(true);
      }
      if (editingRef.current) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeRef.current) {
          const edgeId = selectedEdgeRef.current;
          setEdges((es) => es.filter((ev) => ev.id !== edgeId));
          setSelectedEdge(null);
        } else if (selectedRef.current.length) {
          const ids = new Set(selectedRef.current);
          setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
          setEdges((es) => es.filter((ev) => !ids.has(ev.fromId) && !ids.has(ev.toId)));
          setSelected([]);
        }
      }
      if (e.key === 'Escape') {
        if (toolRef.current !== 'cursor') { toolRef.current = 'cursor'; setTool('cursor'); }
        else { setEditing(null); setSelected([]); setSelectedEdge(null); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const ids = new Set(selectedRef.current);
        if (ids.size) {
          e.preventDefault();
          clipboardRef.current = {
            nodes: nodesRef.current.filter((n) => ids.has(n.id)).map((n) => ({ ...n })),
            edges: edgesRef.current.filter((ev) => ids.has(ev.fromId) && ids.has(ev.toId)).map((ev) => ({ ...ev })),
          };
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const clip = clipboardRef.current;
        if (clip && clip.nodes.length) {
          e.preventDefault();
          const minX = Math.min(...clip.nodes.map((n) => n.x));
          const minY = Math.min(...clip.nodes.map((n) => n.y));
          const maxX = Math.max(...clip.nodes.map((n) => n.x + n.w));
          const maxY = Math.max(...clip.nodes.map((n) => n.y + n.h));
          const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
          const anchor = mouseInVp.current
            ? toC(mouseRef.current.x, mouseRef.current.y, trRef.current)
            : { x: center.x + 30, y: center.y + 30 };
          const dx = anchor.x - center.x, dy = anchor.y - center.y;

          const idMap = new Map<string, string>();
          const newNodes = clip.nodes.map((n) => {
            const id = uid();
            idMap.set(n.id, id);
            return { ...n, id, x: n.x + dx, y: n.y + dy };
          });
          const newEdges = clip.edges.map((ev) => ({
            ...ev,
            id: uid(),
            fromId: idMap.get(ev.fromId)!,
            toId: idMap.get(ev.toId)!,
            points: ev.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          }));

          setNodes((ns) => [...ns, ...newNodes]);
          setEdges((es) => [...es, ...newEdges]);
          setSelected(newNodes.map((n) => n.id));
          setSelectedEdge(null);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceRef.current = false; setSpacePan(false); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup',   onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  /* ── Viewport interactions ────────────────────────────────────────── */
  const onVpDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== vpRef.current) return;
    if (editingRef.current) setEditing(null);
    setSelectedEdge(null);

    const r  = vpRef.current!.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;

    // MMB, Space+LMB, or Hand tool → pan
    if (e.button === 1 || (e.button === 0 && (spaceRef.current || toolRef.current === 'hand'))) {
      e.preventDefault();
      const t = trRef.current;
      setDrag({ type: 'pan', startX: e.clientX, startY: e.clientY, ox: t.x, oy: t.y });
      return;
    }
    if (e.button !== 0) return;

    setSelected([]);
    if (toolRef.current === 'cursor') {
      setDrag({ type: 'select', sx: cx, sy: cy, ex: cx, ey: cy });
    } else if (toolRef.current === 'pencil') {
      setDrag({ type: 'pencil', points: [toC(cx, cy, trRef.current)] });
    } else {
      setDrag({ type: 'draw', sx: cx, sy: cy, ex: cx, ey: cy });
    }
  }, []);

  const onVpDblClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== vpRef.current || toolRef.current !== 'cursor') return;
    const r   = vpRef.current!.getBoundingClientRect();
    const pos = toC(e.clientX - r.left, e.clientY - r.top, trRef.current);
    const id  = uid();
    setNodes((ns) => [...ns, mkNode(id, pos.x - DEF_W / 2, pos.y - DEF_H / 2, DEF_W, DEF_H, 'box')]);
    setSelected([id]);
    setEditing(id);
  }, []);

  /* ── Node callbacks ───────────────────────────────────────────────── */
  const startNodeDrag = useCallback((e: React.MouseEvent, node: BNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Keep the contentEditable focused while dragging the node it belongs to.
    if (editingRef.current === node.id) e.preventDefault();
    setSelectedEdge(null);

    const curSel = selectedRef.current;
    let ids: string[];

    if (e.ctrlKey || e.metaKey) {
      ids = curSel.includes(node.id)
        ? curSel.filter((id) => id !== node.id)
        : [...curSel, node.id];
      setSelected(ids);
    } else if (curSel.includes(node.id)) {
      ids = curSel;
    } else {
      ids = [node.id];
      setSelected(ids);
    }

    const ns = nodesRef.current;
    const origins: Record<string, XY> = {};
    for (const id of ids) {
      const n = ns.find((n) => n.id === id);
      if (n) origins[id] = { x: n.x, y: n.y };
    }
    setDrag({ type: 'nodes', ids, startX: e.clientX, startY: e.clientY, origins });
  }, []);

  const startEdge = useCallback((e: React.MouseEvent, node: BNode, side: Side) => {
    e.stopPropagation(); e.preventDefault();
    setSelectedEdge(null);
    const r = vpRef.current!.getBoundingClientRect();
    setDrag({ type: 'edge', fromId: node.id, fromSide: side, toSX: e.clientX - r.left, toSY: e.clientY - r.top });
  }, []);

  const startResize = useCallback((e: React.MouseEvent, node: BNode, edge: ResizeEdge) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    setDrag({ type: 'resize', id: node.id, edge, startX: e.clientX, startY: e.clientY, origin: { x: node.x, y: node.y, w: node.w, h: node.h } });
  }, []);

  /* ── Edge interactions ────────────────────────────────────────────── */
  const onEdgeDown = useCallback((e: React.MouseEvent, edge: BEdge, verts: XY[]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelected([]);
    if (selectedEdgeRef.current !== edge.id) {
      setSelectedEdge(edge.id);
      return;
    }
    // Already selected — add a bend point on the nearest segment.
    const r = vpRef.current!.getBoundingClientRect();
    const pt = toC(e.clientX - r.left, e.clientY - r.top, trRef.current);
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < verts.length - 1; i++) {
      const d = distToSegment(pt, verts[i], verts[i + 1]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    setEdges((es) => es.map((ev) => ev.id === edge.id
      ? { ...ev, points: [...ev.points.slice(0, bestIdx), pt, ...ev.points.slice(bestIdx)] }
      : ev));
  }, []);

  const startEdgePointDrag = useCallback((e: React.MouseEvent, edgeId: string, index: number, origin: XY) => {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    setDrag({ type: 'edgePoint', edgeId, index, startX: e.clientX, startY: e.clientY, origin });
  }, []);

  const deleteEdgePoint = useCallback((e: React.MouseEvent, edgeId: string, index: number) => {
    e.stopPropagation();
    setEdges((es) => es.map((ev) => ev.id === edgeId ? { ...ev, points: ev.points.filter((_, i) => i !== index) } : ev));
  }, []);

  const deleteSelectedEdge = useCallback(() => {
    setEdges((es) => es.filter((ev) => ev.id !== selectedEdgeRef.current));
    setSelectedEdge(null);
  }, []);

  const updateText = useCallback((id: string, text: string) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, text } : n));
  }, []);

  /* ── Properties ───────────────────────────────────────────────────── */
  const changeFontSize = useCallback((id: string, delta: number) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, fontSize: clmp(n.fontSize + delta, 8, 72) } : n));
  }, []);

  const changeShape = useCallback((id: string, shape: NodeShape) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      return { ...n, shape, h: shape === 'circle' ? n.w : n.h };
    }));
  }, []);

  const changeStrokeColor = useCallback((id: string, color: string) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, color } : n));
  }, []);

  const changeStrokeW = useCallback((id: string, delta: number) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, strokeW: clmp((n.strokeW ?? DEF_PEN_WIDTH) + delta, PEN_MIN_W, PEN_MAX_W) } : n));
  }, []);

  const deleteSelected = useCallback(() => {
    const ids = new Set(selectedRef.current);
    if (!ids.size) return;
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
    setEdges((es) => es.filter((ev) => !ids.has(ev.fromId) && !ids.has(ev.toId)));
    setSelected([]);
  }, []);

  /* ── Settings ─────────────────────────────────────────────────────── */
  const updateSettings = useCallback((patch: Partial<BoardSettings>) => {
    setSettings((s) => { const next = { ...s, ...patch }; saveSettings(next); return next; });
  }, []);

  /* ── Fit / zoom ───────────────────────────────────────────────────── */
  const fitView = useCallback(() => {
    if (!nodes.length) { setTr({ x: 0, y: 0, scale: 1 }); return; }
    const vp = vpRef.current!;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...nodes.map((n) => n.y + n.h));
    const pad  = 80;
    const s    = clmp(Math.min((vp.offsetWidth - pad * 2) / (maxX - minX || 1), (vp.offsetHeight - pad * 2) / (maxY - minY || 1)), MIN_S, 1.5);
    setTr({ x: (vp.offsetWidth - (maxX - minX) * s) / 2 - minX * s, y: (vp.offsetHeight - (maxY - minY) * s) / 2 - minY * s, scale: s });
  }, [nodes]);

  const zoomBtn = useCallback((factor: number) => {
    const vp = vpRef.current!;
    setTr((t) => zoomTo(t, factor, vp.offsetWidth / 2, vp.offsetHeight / 2));
  }, []);

  /* ── Arrow paths ──────────────────────────────────────────────────── */
  const t = tr;
  const arrows = edges.flatMap((edge) => {
    const from = nodes.find((n) => n.id === edge.fromId);
    const to   = nodes.find((n) => n.id === edge.toId);
    if (!from || !to) return [];
    const verts = edgeVerts(from, to, edge);
    const screenVerts = verts.map((v) => toS(v.x, v.y, t));
    const d = roundedPath(screenVerts, EDGE_CORNER_RADIUS);
    return [{ id: edge.id, edge, verts, screenVerts, d }];
  });

  let prevPath: string | null = null;
  let dragTargetId: string | null = null;
  let dragTargetSide: Side | null = null;
  if (drag.type === 'edge') {
    const from = nodes.find((n) => n.id === drag.fromId);
    if (from) {
      const pos = toC(drag.toSX, drag.toSY, t);
      const magnet = findConnectorMagnet(pos, nodes, drag.fromId, CONNECTOR_MAGNET);
      if (magnet) {
        dragTargetId = magnet.node.id;
        dragTargetSide = magnet.side;
        const verts = routeConnector(from, drag.fromSide, magnet.node, magnet.side);
        prevPath = roundedPath(verts.map((v) => toS(v.x, v.y, t)), EDGE_CORNER_RADIUS);
      } else {
        const fp = toS(sidePoint(from, drag.fromSide).x, sidePoint(from, drag.fromSide).y, t);
        prevPath = `M ${fp.x} ${fp.y} L ${drag.toSX} ${drag.toSY}`;
      }
    }
  }

  let edgeActionPos: XY | null = null;
  if (selectedEdge && drag.type === 'none') {
    const found = arrows.find((a) => a.id === selectedEdge);
    if (found) edgeActionPos = found.screenVerts[Math.floor(found.screenVerts.length / 2)];
  }

  /* ── Draw / select previews ───────────────────────────────────────── */
  let drawPrev: { left: number; top: number; w: number; h: number } | null = null;
  if (drag.type === 'draw') {
    const dx = Math.abs(drag.ex - drag.sx), dy = Math.abs(drag.ey - drag.sy);
    if (dx >= MIN_DRAW_PX || dy >= MIN_DRAW_PX) {
      drawPrev = { left: Math.min(drag.sx, drag.ex), top: Math.min(drag.sy, drag.ey), w: dx, h: dy };
    }
  }

  let selectRect: { left: number; top: number; w: number; h: number } | null = null;
  if (drag.type === 'select') {
    const dx = Math.abs(drag.ex - drag.sx), dy = Math.abs(drag.ey - drag.sy);
    if (dx > 4 || dy > 4) {
      selectRect = { left: Math.min(drag.sx, drag.ex), top: Math.min(drag.sy, drag.ey), w: dx, h: dy };
    }
  }

  const pencilPath = drag.type === 'pencil' ? smoothPath(drag.points.map((p) => toS(p.x, p.y, t))) : null;

  /* ── Property panel ───────────────────────────────────────────────── */
  const selNode = selected.length === 1 ? nodes.find((n) => n.id === selected[0]) ?? null : null;
  let propPos: { x: number; y: number } | null = null;
  if (selNode && !editing && drag.type === 'none') {
    const s = toS(selNode.x + selNode.w / 2, selNode.y, t);
    propPos = { x: s.x, y: s.y };
  }

  let multiBar: { x: number; y: number } | null = null;
  if (selected.length > 1 && drag.type === 'none') {
    const sel = nodes.filter((n) => selected.includes(n.id));
    if (sel.length) {
      const minX = Math.min(...sel.map((n) => n.x));
      const maxX = Math.max(...sel.map((n) => n.x + n.w));
      const minY = Math.min(...sel.map((n) => n.y));
      const s    = toS((minX + maxX) / 2, minY, t);
      multiBar = { x: s.x, y: s.y };
    }
  }

  const vpCursor = drag.type === 'pan' ? 'grabbing'
    : (spacePan || tool === 'hand') ? 'grab'
    : (drag.type === 'edge' || drag.type === 'draw' || tool !== 'cursor') ? 'crosshair'
    : drag.type === 'select' ? 'default'
    : 'default';

  return (
    <div className="board-wrap">
    <div
      ref={vpRef}
      className="board-vp"
      style={{ cursor: vpCursor }}
      onMouseDown={onVpDown}
      onDoubleClick={onVpDblClick}
      onMouseEnter={() => { mouseInVp.current = true; }}
      onMouseLeave={() => { mouseInVp.current = false; }}
    >
      {/* SVG arrows */}
      <svg className="board-svg" aria-hidden>
        <defs>
          <marker id="bah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill="#bbb" />
          </marker>
        </defs>
        {arrows.map(({ id, edge, verts, screenVerts, d }) => (
          <g key={id}>
            <path d={d} stroke="transparent" strokeWidth={16} fill="none"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseDown={(e) => onEdgeDown(e, edge, verts)} />
            <path d={d} stroke={selectedEdge === id ? '#4a90e2' : '#c8c8c8'} strokeWidth={selectedEdge === id ? 2.5 : 1.75}
              fill="none" markerEnd="url(#bah)" strokeLinecap="round" strokeLinejoin="round"
              style={{ pointerEvents: 'none', transition: 'stroke 0.15s, stroke-width 0.15s' }} />
            {selectedEdge === id && edge.points.map((p, i) => (
              <circle key={i} cx={screenVerts[i + 1].x} cy={screenVerts[i + 1].y} r={5}
                fill="#fff" stroke="#4a90e2" strokeWidth={2}
                style={{ pointerEvents: 'all', cursor: 'grab' }}
                onMouseDown={(e) => startEdgePointDrag(e, id, i, p)}
                onDoubleClick={(e) => deleteEdgePoint(e, id, i)}
              />
            ))}
          </g>
        ))}
        {prevPath && (
          <path d={prevPath} fill="none"
            stroke="#666" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pencilPath && (
          <path d={pencilPath} fill="none"
            stroke={penColor} strokeWidth={penWidth * t.scale}
            strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>

      {/* Canvas */}
      <div
        className="board-canvas"
        style={{ transform: `translate(${t.x}px,${t.y}px) scale(${t.scale})`, transformOrigin: '0 0' }}
      >
        {nodes.map((node) => (
          <BoardNode
            key={node.id}
            node={node}
            selected={selected.includes(node.id)}
            soloSelected={selected.length === 1 && selected[0] === node.id}
            editing={editing === node.id}
            dropTarget={dragTargetId === node.id}
            dropSide={dragTargetId === node.id ? dragTargetSide : null}
            onDown={(e)       => startNodeDrag(e, node)}
            onDblClick={()    => setEditing(node.id)}
            onHandleDown={(e, side) => startEdge(e, node, side)}
            onResizeDown={(e, edge) => startResize(e, node, edge)}
            onTextInput={(tx) => updateText(node.id, tx)}
            onBlur={()        => setEditing(null)}
            onOpenNote={(id, name) => setNotePanel({ id, name })}
          />
        ))}
      </div>

      {/* Edge actions — selected connector */}
      {selectedEdge && edgeActionPos && (
        <div className="board-props"
          style={{ left: edgeActionPos.x, top: edgeActionPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="bp-val">Стрелка</span>
          <div className="bp-sep" />
          <button className="bp-btn bp-del" title="Удалить (Del)" onClick={deleteSelectedEdge}><Icon name="close" size={13} /></button>
        </div>
      )}

      {/* Draw preview */}
      {drawPrev && (
        <div className="board-draw-preview"
          style={{ left: drawPrev.left, top: drawPrev.top, width: drawPrev.w, height: drawPrev.h }} />
      )}

      {/* Selection rect */}
      {selectRect && (
        <div className="board-select-rect"
          style={{ left: selectRect.left, top: selectRect.top, width: selectRect.w, height: selectRect.h }} />
      )}

      {/* Property panel — single selection */}
      {selNode && propPos && (
        <div className="board-props"
          style={{ left: propPos.x, top: propPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {selNode.kind === 'draw' ? (
            <>
              {DRAW_COLORS.map((c) => (
                <button key={c}
                  className={`bp-btn bp-swatch${(selNode.color ?? DEF_PEN_COLOR) === c ? ' active' : ''}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => changeStrokeColor(selNode.id, c)}
                />
              ))}
              <div className="bp-sep" />
              <button className="bp-btn" onClick={() => changeStrokeW(selNode.id, -1)} title="Тоньше"><Icon name="remove" size={13} /></button>
              <span className="bp-val">{selNode.strokeW ?? DEF_PEN_WIDTH}px</span>
              <button className="bp-btn" onClick={() => changeStrokeW(selNode.id, +1)} title="Толще"><Icon name="add" size={13} /></button>
            </>
          ) : (
            <>
              <button className="bp-btn" onClick={() => changeFontSize(selNode.id, -2)} title="Уменьшить">A−</button>
              <span className="bp-val">{selNode.fontSize}px</span>
              <button className="bp-btn" onClick={() => changeFontSize(selNode.id, +2)} title="Увеличить">A+</button>
              {selNode.kind === 'box' && <>
                <div className="bp-sep" />
                {SHAPES.map((sh) => (
                  <button key={sh.id}
                    className={`bp-btn bp-shape${selNode.shape === sh.id ? ' active' : ''}`}
                    title={sh.label}
                    onClick={() => changeShape(selNode.id, sh.id)}
                  >{sh.icon}</button>
                ))}
              </>}
            </>
          )}
          <div className="bp-sep" />
          <button className="bp-btn bp-del" title="Удалить (Del)" onClick={deleteSelected}><Icon name="close" size={13} /></button>
        </div>
      )}

      {/* Multi-select bar */}
      {selected.length > 1 && multiBar && (
        <div className="board-props"
          style={{ left: multiBar.x, top: multiBar.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="bp-val">{selected.length} выбрано</span>
          <div className="bp-sep" />
          <button className="bp-btn bp-del" title="Удалить (Del)" onClick={deleteSelected}><Icon name="close" size={13} /></button>
        </div>
      )}

      {/* Left tool panel */}
      <div className="board-panel" onMouseDown={(e) => e.stopPropagation()} onMouseEnter={() => { mouseOnUi.current = true; }} onMouseLeave={() => { mouseOnUi.current = false; }}>
        {TOOLS.map((tp) => (
          <button
            key={tp.id}
            className={`board-panel-btn${tool === tp.id ? ' active' : ''}`}
            onClick={() => { setTool(tp.id); toolRef.current = tp.id; }}
            title={tp.label}
          >
            <span className="board-panel-icon"><ToolIcon id={tp.id} /></span>
            <span className="board-panel-label">{tp.label}</span>
          </button>
        ))}
      </div>

      {/* Pencil settings — color/thickness for the next stroke */}
      {tool === 'pencil' && (
        <div className="board-pen-panel" onMouseDown={(e) => e.stopPropagation()} onMouseEnter={() => { mouseOnUi.current = true; }} onMouseLeave={() => { mouseOnUi.current = false; }}>
          {DRAW_COLORS.map((c) => (
            <button key={c}
              className={`bp-btn bp-swatch${penColor === c ? ' active' : ''}`}
              style={{ background: c }}
              title={c}
              onClick={() => setPenColor(c)}
            />
          ))}
          <div className="bp-sep" />
          <button className="bp-btn" onClick={() => setPenWidth((w) => clmp(w - 1, PEN_MIN_W, PEN_MAX_W))} title="Тоньше"><Icon name="remove" size={13} /></button>
          <span className="bp-val">{penWidth}px</span>
          <button className="bp-btn" onClick={() => setPenWidth((w) => clmp(w + 1, PEN_MIN_W, PEN_MAX_W))} title="Толще"><Icon name="add" size={13} /></button>
        </div>
      )}

      {/* Bottom bar */}
      <div className="board-bar" onMouseDown={(e) => e.stopPropagation()} onMouseEnter={() => { mouseOnUi.current = true; }} onMouseLeave={() => { mouseOnUi.current = false; }}>
        <button className="board-btn board-btn-icon" onClick={() => zoomBtn(1.25)}><Icon name="add" size={14} /></button>
        <span className="board-zoom-pct">{Math.round(t.scale * 100)}%</span>
        <button className="board-btn board-btn-icon" onClick={() => zoomBtn(1 / 1.25)}><Icon name="remove" size={14} /></button>
        <div style={{ flex: 1 }} />
        <button className="board-btn board-settings-btn" onClick={() => setSettingsOpen(true)} title="Настройки"><Icon name="settings-1" size={16} /></button>
      </div>

      <div className="board-hint">
        {tool === 'cursor'
          ? <>Потяни — выделить · Клик по блоку — выбрать · Двойной клик — редактировать текст · <span className="board-hint-dot">●</span> — стрелка · Клик по стрелке — выделить, ещё раз — изгиб</>
          : tool === 'hand'
          ? <>Потяни — переместить доску</>
          : tool === 'pencil'
          ? <>Рисуй — свободные линии · Esc — выйти из режима</>
          : <>Кликни или потяни — создать · Esc — отмена</>
        }
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div className="board-settings-overlay"
          onMouseDown={(e) => { e.stopPropagation(); setSettingsOpen(false); }}
        >
          <div className="board-settings-modal" onMouseDown={(e) => e.stopPropagation()} onMouseEnter={() => { mouseOnUi.current = true; }} onMouseLeave={() => { mouseOnUi.current = false; }}>
            <div className="bsm-header">
              <span className="bsm-title">Настройки доски</span>
              <button className="bsm-close" onClick={() => setSettingsOpen(false)}><Icon name="close" size={13} /></button>
            </div>

            <div className="bsm-group">
              <div className="bsm-row">
                <span className="bsm-label">Автопрокрутка у краёв</span>
                <label className="bsm-toggle">
                  <input type="checkbox" checked={settings.edgePan}
                    onChange={(e) => updateSettings({ edgePan: e.target.checked })} />
                  <span className="bsm-track"><span className="bsm-thumb" /></span>
                </label>
              </div>

              <div className={`bsm-sliders${settings.edgePan ? '' : ' off'}`}>
                <div className="bsm-row">
                  <span className="bsm-label">Зона у края</span>
                  <span className="bsm-val">{settings.edgePanThreshold}px</span>
                </div>
                <input type="range" className="bsm-slider" min={20} max={200} step={10}
                  value={settings.edgePanThreshold} disabled={!settings.edgePan}
                  onChange={(e) => updateSettings({ edgePanThreshold: +e.target.value })} />

                <div className="bsm-row" style={{ marginTop: 14 }}>
                  <span className="bsm-label">Скорость</span>
                  <span className="bsm-val">{settings.edgePanSpeed}</span>
                </div>
                <input type="range" className="bsm-slider" min={1} max={20} step={1}
                  value={settings.edgePanSpeed} disabled={!settings.edgePan}
                  onChange={(e) => updateSettings({ edgePanSpeed: +e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    <NoteAside note={notePanel} onClose={() => setNotePanel(null)} />
    </div>
  );
}

/* ─── NoteAside ──────────────────────────────────────────────────────────── */
function NoteAside({ note, onClose }: { note: { id: string; name: string } | null; onClose: () => void }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!note) { setHtml(''); return; }
    const md = spaceReadContent(note.id);
    setHtml(md ? parseMarkdown(md) : '<p style="color:#ccc">Файл пустой</p>');
  }, [note?.id]);

  // Manual <details> toggle: works regardless of browser quirks with
  // native summary activation inside the board environment.
  const onBodyClick = useCallback((e: React.MouseEvent) => {
    const summary = (e.target as HTMLElement).closest('summary');
    if (!summary) return;
    e.preventDefault();
    const details = summary.closest('details');
    if (details) details.open = !details.open;
  }, []);

  return (
    <aside className={`board-aside${note ? ' open' : ''}`}>
      <div className="ba-header">
        <span className="ba-title">{note?.name ?? ''}</span>
        <div className="ba-actions">
          {note && (
            <a
              className="ba-open-link"
              href={`/space?file=${note.id}`}
              title="Открыть в Пространстве"
            >
              <Icon name="external-link" size={14} />
            </a>
          )}
          <button className="ba-close" onClick={onClose}><Icon name="close" size={13} /></button>
        </div>
      </div>
      <div
        className="ba-body editor-preview"
        onClick={onBodyClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </aside>
  );
}

/* ─── Text with refs renderer ────────────────────────────────────────────── */
const REF_RE = /\[\[space:([^|]+)\|([^\]]+)\]\]/g;

function renderNodeText(
  text: string,
  fontSize: number,
  onOpenNote: (id: string, name: string) => void,
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, id, name] = m;
    parts.push(
      <span
        key={`${id}-${m.index}`}
        className="board-ref-chip"
        style={{ fontSize: Math.max(fontSize - 2, 10) }}
        onClick={(e) => { e.stopPropagation(); onOpenNote(id, name); }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Icon name="file" size={11} /> {name}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ─── SlashMenu ──────────────────────────────────────────────────────────── */
interface SpaceFile { id: string; name: string; }

interface SlashMenuProps {
  query: string;
  x: number; y: number;
  activeIndex: number;
  files: SpaceFile[];
  onSelect: (f: SpaceFile) => void;
  onClose: () => void;
}

function SlashMenu({ query, x, y, activeIndex, files, onSelect, onClose }: SlashMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const filtered = useMemo(() =>
    files.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [files, query]
  );

  return (
    <div
      className="board-slash-menu"
      style={{ left: x, top: y + 6 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {query && <div className="bsm-query">/{query}</div>}
      <div ref={listRef} className="bsm-list">
        {filtered.length === 0 ? (
          <div className="bsm-empty">Файлов не найдено</div>
        ) : filtered.map((f, i) => (
          <div
            key={f.id}
            className={`bsm-item${i === activeIndex ? ' active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); onSelect(f); }}
          >
            <span className="bsm-item-icon"><Icon name="file" size={13} /></span>
            <span className="bsm-item-name">{f.name}</span>
          </div>
        ))}
      </div>
      <div className="bsm-hint">↑↓ навигация · Enter выбрать · Esc закрыть</div>
    </div>
  );
}

/* ─── BoardNode ──────────────────────────────────────────────────────────── */
interface NodeProps {
  node: BNode; selected: boolean; soloSelected: boolean; editing: boolean; dropTarget: boolean; dropSide: Side | null;
  onDown: (e: React.MouseEvent) => void;
  onDblClick: () => void;
  onHandleDown: (e: React.MouseEvent, side: Side) => void;
  onResizeDown: (e: React.MouseEvent, edge: ResizeEdge) => void;
  onTextInput: (text: string) => void;
  onBlur: () => void;
  onOpenNote: (id: string, name: string) => void;
}

const RESIZE_EDGES: ResizeEdge[] = ['n', 's', 'e', 'w'];
const RESIZE_CORNERS: ResizeEdge[] = ['nw', 'ne', 'sw', 'se'];

const BoardNode = memo(function BoardNode({
  node, selected, soloSelected, editing, dropTarget, dropSide, onDown, onDblClick, onHandleDown, onResizeDown, onTextInput, onBlur, onOpenNote,
}: NodeProps) {
  const ref          = useRef<HTMLDivElement>(null);
  const savedRange   = useRef<Range | null>(null);
  const slashQuery   = useRef('');
  const [slashMenu,  setSlashMenu]  = useState<{ x: number; y: number } | null>(null);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [spaceFiles, setSpaceFiles] = useState<SpaceFile[]>([]);
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.textContent = node.text;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el); r.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Close slash menu when editing ends
  useEffect(() => {
    if (!editing) { setSlashMenu(null); slashQuery.current = ''; }
  }, [editing]);

  const openSlash = useCallback((x: number, y: number) => {
    try {
      const raw = JSON.parse(localStorage.getItem('space_nodes_v1') ?? '[]') as Array<{ id: string; name: string; type: string }>;
      setSpaceFiles(raw.filter((n) => n.type === 'file'));
    } catch { setSpaceFiles([]); }
    slashQuery.current = '';
    setActiveIdx(0);
    setSlashMenu({ x, y });
  }, []);

  const closeSlash = useCallback(() => {
    setSlashMenu(null);
    slashQuery.current = '';
    ref.current?.focus();
  }, []);

  const insertRef = useCallback((file: SpaceFile) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    const notation = `[[space:${file.id}|${file.name}]]`;
    document.execCommand('insertText', false, notation);
    onTextInput(el.textContent ?? '');
    setSlashMenu(null);
    slashQuery.current = '';
    savedRange.current = null;
  }, [onTextInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (e.key === '/') {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel?.rangeCount) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        openSlash(rect.left, rect.bottom);
      }
      return;
    }

    if (slashMenu) {
      if (e.key === 'Escape')     { e.preventDefault(); closeSlash(); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx((i) => i + 1); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const filtered = spaceFiles.filter((f) => f.name.toLowerCase().includes(slashQuery.current.toLowerCase()));
        if (filtered[activeIdx]) insertRef(filtered[activeIdx]);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (slashQuery.current.length > 0) {
          slashQuery.current = slashQuery.current.slice(0, -1);
          setSlashMenu((m) => m ? { ...m } : null); // force re-render
        } else {
          closeSlash();
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        slashQuery.current += e.key;
        setActiveIdx(0);
        setSlashMenu((m) => m ? { ...m } : null);
        return;
      }
    }

    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault(); e.currentTarget.blur();
    }
  }, [slashMenu, activeIdx, spaceFiles, openSlash, closeSlash, insertRef]);

  const isText    = node.kind === 'text';
  const isDraw    = node.kind === 'draw';
  const isCircle  = !isText && !isDraw && node.shape === 'circle';
  const isDiamond = !isText && !isDraw && node.shape === 'diamond';
  const centered  = isCircle || isDiamond;
  const nodeH     = isCircle ? node.w : node.h;

  const filtered = useMemo(() =>
    spaceFiles.filter((f) => f.name.toLowerCase().includes(slashQuery.current.toLowerCase())),
    // slashMenu dep triggers recompute when query changes via setSlashMenu re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spaceFiles, slashMenu]
  );

  return (
    <div
      className={`board-node${isText ? ' bk-text' : ''}${isDraw ? ' draw-kind' : ''} shape-${node.shape}${selected ? ' sel' : ''}${dropTarget ? ' drop-target' : ''}`}
      style={{ left: node.x, top: node.y, width: node.w, height: nodeH }}
      onMouseDown={onDown}
      onDoubleClick={(e) => { if (!isDraw) { e.stopPropagation(); onDblClick(); } }}
    >
      {!isText && !isDraw && <div className="node-bg" />}

      {isDraw ? (
        <svg className="board-draw-svg" width={node.w} height={node.h} aria-hidden>
          <path d={smoothPath((node.points ?? []).map((p) => ({ x: p.x * node.w, y: p.y * node.h })))}
            fill="none" stroke={node.color ?? DEF_PEN_COLOR} strokeWidth={node.strokeW ?? DEF_PEN_WIDTH}
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <div className={`node-content${centered ? ' centered' : ''}`}>
          {editing ? (
            <div
              key="editable"
              ref={ref}
              className="board-node-text"
              style={{ fontSize: node.fontSize, lineHeight: 1.4 }}
              contentEditable
              suppressContentEditableWarning
              onMouseDown={(e) => e.stopPropagation()}
              onInput={(e) => onTextInput(e.currentTarget.textContent ?? '')}
              onBlur={() => { if (!slashMenu) onBlur(); }}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <div
              key="display"
              className="board-node-text"
              style={{ fontSize: node.fontSize, lineHeight: 1.4, color: node.text ? '#111' : '#ccc' }}
            >
              {node.text ? renderNodeText(node.text, node.fontSize, onOpenNote) : 'Текст...'}
            </div>
          )}
        </div>
      )}

      {!isDraw && (['n','s','e','w'] as const).map((p) => (
        <div key={p} className={`board-handle bh-${p}${dropSide === p ? ' bh-target' : ''}`}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onHandleDown(e, p); }} />
      ))}

      {soloSelected && (
        <>
          {!isCircle && RESIZE_EDGES.map((edge) => (
            <div key={`re-${edge}`} className={`board-resize-edge re-${edge}`}
              onMouseDown={(e) => onResizeDown(e, edge)} />
          ))}
          {RESIZE_CORNERS.map((edge) => (
            <div key={`rc-${edge}`} className={`board-resize-corner rc-${edge}`}
              onMouseDown={(e) => onResizeDown(e, edge)} />
          ))}
        </>
      )}

      {mounted && slashMenu && createPortal(
        <SlashMenu
          query={slashQuery.current}
          x={slashMenu.x}
          y={slashMenu.y}
          activeIndex={Math.min(activeIdx, Math.max(0, filtered.length - 1))}
          files={filtered}
          onSelect={insertRef}
          onClose={closeSlash}
        />,
        document.body
      )}
    </div>
  );
});
