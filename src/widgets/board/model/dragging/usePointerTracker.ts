'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { XY } from '@/entities/board';

export interface PointerTracker {
  /** Cursor position relative to the viewport box. */
  pos: RefObject<XY>;
  inViewport: RefObject<boolean>;
  /** True while the cursor sits on a floating panel — edge-pan must not fight the toolbar. */
  onUi: RefObject<boolean>;
  viewportProps: { onPointerEnter: () => void; onPointerLeave: () => void };
  /** Spread onto any floating panel: marks it as UI and keeps clicks off the canvas. */
  uiProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
  };
}

/**
 * Указатель — мышь, перо или палец: доска слушает pointer-события, а не mouse.
 *
 * Совместимостные mouse-события браузер шлёт только по завершении касания и
 * только для одиночных тапов — перетаскивания через них не видно вовсе, поэтому
 * на сенсорном экране доска с mouse-обработчиками просто не работала.
 * `pointerenter`/`pointerleave` по касанию тоже приходят, так что флаг `onUi`
 * остаётся верным и во время жеста на плавающей панели.
 */
export function usePointerTracker(vpRef: RefObject<HTMLDivElement | null>): PointerTracker {
  const pos = useRef<XY>({ x: -1, y: -1 });
  const inViewport = useRef(false);
  const onUi = useRef(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = vpRef.current?.getBoundingClientRect();
      pos.current = { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [vpRef]);

  return useMemo(
    () => ({
      pos,
      inViewport,
      onUi,
      viewportProps: {
        onPointerEnter: () => {
          inViewport.current = true;
        },
        onPointerLeave: () => {
          inViewport.current = false;
        },
      },
      uiProps: {
        onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
        onPointerEnter: () => {
          onUi.current = true;
        },
        onPointerLeave: () => {
          onUi.current = false;
        },
      },
    }),
    [],
  );
}
