'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type NodeKind  = 'box' | 'text';
type NodeShape = 'rect' | 'diamond' | 'circle';

interface BNode {
  id: string; x: number; y: number;
  w: number; h: number;
  text: string;
  kind: NodeKind;
  fontSize: number;
  shape: NodeShape;
}
interface BEdge { id: string; fromId: string; toId: string; }
interface XY    { x: number; y: number; }
interface T     { x: number; y: number; scale: number; }

type Tool = 'cursor' | 'box' | 'text';

type Drag =
  | { type: 'none' }
  | { type: 'pan';  startX: number; startY: number; ox: number; oy: number }
  | { type: 'node'; id: string; startX: number; startY: number; ox: number; oy: number }
  | { type: 'edge'; fromId: string; toSX: number; toSY: number }
  | { type: 'draw'; sx: number; sy: number; ex: number; ey: number };

/* ─── Constants ─────────────────────────────────────────────────────────── */
const DEF_W = 160, DEF_H = 80;
const MIN_DRAW_PX = 10;
const MIN_S = 0.08, MAX_S = 4;
const KEY = 'board_data_v1';

/* ─── Tools / shapes ─────────────────────────────────────────────────────── */
const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'cursor', icon: '↖', label: 'Курсор' },
  { id: 'box',    icon: '□', label: 'Блок'   },
  { id: 'text',   icon: 'T', label: 'Текст'  },
];

const SHAPES: { id: NodeShape; icon: string; label: string }[] = [
  { id: 'rect',    icon: '▭', label: 'Прямоугольник' },
  { id: 'diamond', icon: '◇', label: 'Ромб'           },
  { id: 'circle',  icon: '○', label: 'Круг'           },
];

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
      edges: raw.edges ?? [],
    };
  } catch { return { nodes: [], edges: [] }; }
}
function saveData(d: { nodes: BNode[]; edges: BEdge[] }) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
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

/* ─── BoardCanvas ────────────────────────────────────────────────────────── */
export function BoardCanvas() {
  const [nodes,    setNodes]    = useState<BNode[]>([]);
  const [edges,    setEdges]    = useState<BEdge[]>([]);
  const [tr,       setTr]       = useState<T>({ x: 0, y: 0, scale: 1 });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing,  setEditing]  = useState<string | null>(null);
  const [drag,     setDrag]     = useState<Drag>({ type: 'none' });
  const [tool,     setTool]     = useState<Tool>('cursor');
  const [ready,    setReady]    = useState(false);

  const vpRef      = useRef<HTMLDivElement>(null);
  const trRef      = useRef(tr);       trRef.current      = tr;
  const nodesRef   = useRef(nodes);    nodesRef.current   = nodes;
  const dragRef    = useRef(drag);     dragRef.current    = drag;
  const editingRef = useRef(editing);  editingRef.current = editing;
  const toolRef    = useRef(tool);     toolRef.current    = tool;
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load / save ─────────────────────────────────────────────────── */
  useEffect(() => { const d = loadData(); setNodes(d.nodes); setEdges(d.edges); setReady(true); }, []);
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData({ nodes, edges }), 500);
  }, [nodes, edges, ready]);

  /* ── Global mouse ─────────────────────────────────────────────────── */
  useEffect(() => {
    const vpR = () => vpRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };

    const onMove = (e: MouseEvent) => {
      const d = dragRef.current, t = trRef.current;
      if (d.type === 'pan') {
        setTr({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY), scale: t.scale });
      } else if (d.type === 'node') {
        const dx = (e.clientX - d.startX) / t.scale;
        const dy = (e.clientY - d.startY) / t.scale;
        setNodes((ns) => ns.map((n) => n.id === d.id ? { ...n, x: d.ox + dx, y: d.oy + dy } : n));
      } else if (d.type === 'edge') {
        const r = vpR();
        setDrag({ ...d, toSX: e.clientX - r.left, toSY: e.clientY - r.top });
      } else if (d.type === 'draw') {
        const r = vpR();
        setDrag({ ...d, ex: e.clientX - r.left, ey: e.clientY - r.top });
      }
    };

    const onUp = (e: MouseEvent) => {
      const d = dragRef.current, t = trRef.current;
      if (d.type === 'edge') {
        const r   = vpR();
        const pos = toC(e.clientX - r.left, e.clientY - r.top, t);
        const hit = nodesRef.current.find(
          (n) => pos.x >= n.x && pos.x <= n.x + n.w && pos.y >= n.y && pos.y <= n.y + n.h && n.id !== d.fromId
        );
        if (hit) {
          setEdges((es) => {
            if (es.some((e) => e.fromId === d.fromId && e.toId === hit.id)) return es;
            return [...es, { id: uid(), fromId: d.fromId, toId: hit.id }];
          });
        }
      } else if (d.type === 'draw') {
        const dx   = Math.abs(d.ex - d.sx);
        const dy   = Math.abs(d.ey - d.sy);
        const kind: NodeKind = toolRef.current === 'text' ? 'text' : 'box';
        const id   = uid();
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
        setSelected(id);
        setEditing(id);
        // Return to cursor immediately so double-click doesn't fire a second draw
        toolRef.current = 'cursor';
        setTool('cursor');
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
      if (editingRef.current) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        setNodes((ns) => ns.filter((n) => n.id !== selected));
        setEdges((es) => es.filter((e) => e.fromId !== selected && e.toId !== selected));
        setSelected(null);
      }
      if (e.key === 'Escape') {
        if (toolRef.current !== 'cursor') { toolRef.current = 'cursor'; setTool('cursor'); }
        else { setEditing(null); setSelected(null); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  /* ── Viewport interactions ────────────────────────────────────────── */
  const onVpDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || e.target !== vpRef.current) return;
    if (editingRef.current) setEditing(null);
    setSelected(null);

    const r  = vpRef.current!.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;

    if (toolRef.current === 'cursor') {
      const t = trRef.current;
      setDrag({ type: 'pan', startX: e.clientX, startY: e.clientY, ox: t.x, oy: t.y });
    } else {
      setDrag({ type: 'draw', sx: cx, sy: cy, ex: cx, ey: cy });
    }
  }, []);

  // Double-click on canvas in cursor mode creates a default box
  const onVpDblClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== vpRef.current || toolRef.current !== 'cursor') return;
    const r   = vpRef.current!.getBoundingClientRect();
    const pos = toC(e.clientX - r.left, e.clientY - r.top, trRef.current);
    const id  = uid();
    setNodes((ns) => [...ns, mkNode(id, pos.x - DEF_W / 2, pos.y - DEF_H / 2, DEF_W, DEF_H, 'box')]);
    setSelected(id);
    setEditing(id);
  }, []);

  /* ── Node callbacks ───────────────────────────────────────────────── */
  const startNodeDrag = useCallback((e: React.MouseEvent, node: BNode) => {
    if (e.button !== 0 || editingRef.current === node.id) return;
    e.stopPropagation();
    setSelected(node.id);
    setDrag({ type: 'node', id: node.id, startX: e.clientX, startY: e.clientY, ox: node.x, oy: node.y });
  }, []);

  const startEdge = useCallback((e: React.MouseEvent, node: BNode) => {
    e.stopPropagation(); e.preventDefault();
    const r = vpRef.current!.getBoundingClientRect();
    setDrag({ type: 'edge', fromId: node.id, toSX: e.clientX - r.left, toSY: e.clientY - r.top });
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

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setNodes((ns) => ns.filter((n) => n.id !== selected));
    setEdges((es) => es.filter((e) => e.fromId !== selected && e.toId !== selected));
    setSelected(null);
  }, [selected]);

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
    const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const tc = { x: to.x   + to.w   / 2, y: to.y   + to.h   / 2 };
    const fp = toS(borderPt(from, tc).x, borderPt(from, tc).y, t);
    const tp = toS(borderPt(to,   fc).x, borderPt(to,   fc).y, t);
    const mx = (fp.x + tp.x) / 2;
    return [{ id: edge.id, d: `M ${fp.x} ${fp.y} C ${mx} ${fp.y} ${mx} ${tp.y} ${tp.x} ${tp.y}` }];
  });

  let prevLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (drag.type === 'edge') {
    const from = nodes.find((n) => n.id === drag.fromId);
    if (from) {
      const tC = toC(drag.toSX, drag.toSY, t);
      const fp = toS(borderPt(from, tC).x, borderPt(from, tC).y, t);
      prevLine = { x1: fp.x, y1: fp.y, x2: drag.toSX, y2: drag.toSY };
    }
  }

  /* ── Draw preview ─────────────────────────────────────────────────── */
  let drawPrev: { left: number; top: number; w: number; h: number } | null = null;
  if (drag.type === 'draw') {
    const dx = Math.abs(drag.ex - drag.sx), dy = Math.abs(drag.ey - drag.sy);
    if (dx >= MIN_DRAW_PX || dy >= MIN_DRAW_PX) {
      drawPrev = { left: Math.min(drag.sx, drag.ex), top: Math.min(drag.sy, drag.ey), w: dx, h: dy };
    }
  }

  /* ── Property panel ───────────────────────────────────────────────── */
  const selNode = selected ? nodes.find((n) => n.id === selected) ?? null : null;
  let propPos: { x: number; y: number } | null = null;
  if (selNode && !editing && drag.type === 'none') {
    const s = toS(selNode.x + selNode.w / 2, selNode.y, t);
    propPos = { x: s.x, y: s.y };
  }

  const vpCursor = drag.type === 'pan' ? 'grabbing'
    : (drag.type === 'edge' || drag.type === 'draw' || tool !== 'cursor') ? 'crosshair'
    : 'default';

  return (
    <div
      ref={vpRef}
      className="board-vp"
      style={{ cursor: vpCursor }}
      onMouseDown={onVpDown}
      onDoubleClick={onVpDblClick}
    >
      {/* SVG arrows */}
      <svg className="board-svg" aria-hidden>
        <defs>
          <marker id="bah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0,8 3,0 6" fill="#bbb" />
          </marker>
        </defs>
        {arrows.map(({ id, d }) => (
          <path key={id} d={d} stroke="#c8c8c8" strokeWidth={1.5} fill="none" markerEnd="url(#bah)" />
        ))}
        {prevLine && (
          <line x1={prevLine.x1} y1={prevLine.y1} x2={prevLine.x2} y2={prevLine.y2}
            stroke="#666" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7} />
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
            selected={selected === node.id}
            editing={editing  === node.id}
            onDown={(e)       => startNodeDrag(e, node)}
            onDblClick={()    => { setEditing(node.id); setSelected(node.id); }}
            onHandleDown={(e) => startEdge(e, node)}
            onTextInput={(tx) => updateText(node.id, tx)}
            onBlur={()        => setEditing(null)}
          />
        ))}
      </div>

      {/* Draw preview */}
      {drawPrev && (
        <div className="board-draw-preview"
          style={{ left: drawPrev.left, top: drawPrev.top, width: drawPrev.w, height: drawPrev.h }} />
      )}

      {/* Property panel */}
      {selNode && propPos && (
        <div className="board-props"
          style={{ left: propPos.x, top: propPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
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
          <div className="bp-sep" />
          <button className="bp-btn bp-del" title="Удалить (Del)" onClick={deleteSelected}>✕</button>
        </div>
      )}

      {/* Left tool panel */}
      <div className="board-panel" onMouseDown={(e) => e.stopPropagation()}>
        {TOOLS.map((tp) => (
          <button
            key={tp.id}
            className={`board-panel-btn${tool === tp.id ? ' active' : ''}`}
            onClick={() => { setTool(tp.id); toolRef.current = tp.id; }}
            title={tp.label}
          >
            <span className="board-panel-icon">{tp.icon}</span>
            <span className="board-panel-label">{tp.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="board-bar" onMouseDown={(e) => e.stopPropagation()}>
        <button className="board-btn" onClick={fitView}>Вписать</button>
        <button className="board-btn board-btn-icon" onClick={() => zoomBtn(1.25)}>+</button>
        <span className="board-zoom-pct">{Math.round(t.scale * 100)}%</span>
        <button className="board-btn board-btn-icon" onClick={() => zoomBtn(1 / 1.25)}>−</button>
      </div>

      <div className="board-hint">
        {tool === 'cursor'
          ? <>Дбл.клик — блок · Потяни за <span className="board-hint-dot">●</span> — стрелка · Ctrl+Scroll — зум</>
          : <>Кликни или потяни — создать · Esc — отмена</>
        }
      </div>
    </div>
  );
}

/* ─── BoardNode ──────────────────────────────────────────────────────────── */
interface NodeProps {
  node: BNode; selected: boolean; editing: boolean;
  onDown: (e: React.MouseEvent) => void;
  onDblClick: () => void;
  onHandleDown: (e: React.MouseEvent) => void;
  onTextInput: (text: string) => void;
  onBlur: () => void;
}

const BoardNode = memo(function BoardNode({
  node, selected, editing, onDown, onDblClick, onHandleDown, onTextInput, onBlur,
}: NodeProps) {
  const ref = useRef<HTMLDivElement>(null);

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

  const isText    = node.kind === 'text';
  const isCircle  = !isText && node.shape === 'circle';
  const isDiamond = !isText && node.shape === 'diamond';
  const centered  = isCircle || isDiamond;
  const nodeH     = isCircle ? node.w : node.h;

  return (
    <div
      className={`board-node${isText ? ' bk-text' : ''} shape-${node.shape}${selected ? ' sel' : ''}`}
      style={{ left: node.x, top: node.y, width: node.w, height: nodeH }}
      onMouseDown={onDown}
      onDoubleClick={(e) => { e.stopPropagation(); onDblClick(); }}
    >
      {!isText && <div className="node-bg" />}

      <div className={`node-content${centered ? ' centered' : ''}`}>
        {editing ? (
          <div
            ref={ref}
            className="board-node-text"
            style={{ fontSize: node.fontSize, lineHeight: 1.4 }}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onTextInput(e.currentTarget.textContent ?? '')}
            onBlur={() => onBlur()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                e.preventDefault(); e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <div
            className="board-node-text"
            style={{ fontSize: node.fontSize, lineHeight: 1.4, color: node.text ? '#111' : '#ccc' }}
          >
            {node.text || 'Текст...'}
          </div>
        )}
      </div>

      {(['n','s','e','w'] as const).map((p) => (
        <div key={p} className={`board-handle bh-${p}`}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onHandleDown(e); }} />
      ))}
    </div>
  );
});
