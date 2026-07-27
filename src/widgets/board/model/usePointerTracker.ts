'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { XY } from '@/entities/board';

export interface PointerTracker {
  /** Cursor position relative to the viewport box. */
  pos: RefObject<XY>;
  inViewport: RefObject<boolean>;
  /** True while the cursor sits on a floating panel — edge-pan must not fight the toolbar. */
  onUi: RefObject<boolean>;
  viewportProps: { onMouseEnter: () => void; onMouseLeave: () => void };
  /** Spread onto any floating panel: marks it as UI and keeps clicks off the canvas. */
  uiProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

export function usePointerTracker(vpRef: RefObject<HTMLDivElement | null>): PointerTracker {
  const pos        = useRef<XY>({ x: -1, y: -1 });
  const inViewport = useRef(false);
  const onUi       = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = vpRef.current?.getBoundingClientRect();
      pos.current = { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [vpRef]);

  return useMemo(() => ({
    pos, inViewport, onUi,
    viewportProps: {
      onMouseEnter: () => { inViewport.current = true; },
      onMouseLeave: () => { inViewport.current = false; },
    },
    uiProps: {
      onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
      onMouseEnter: () => { onUi.current = true; },
      onMouseLeave: () => { onUi.current = false; },
    },
  }), []);
}
