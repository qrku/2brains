'use client';

import { useEffect, type RefObject } from 'react';
import type { PointerTracker } from './usePointerTracker';
import type { BoardStore } from '../useBoardStore';

/**
 * Scrolls the board when the cursor lingers near a viewport edge, so a node can be dragged
 * beyond the visible area. Runs off rAF rather than mousemove — panning must continue while
 * the cursor is held still.
 *
 * Only ever active during a drag: edge-panning on a bare hover would scroll the board out from
 * under a cursor that just happened to rest near the edge. The rAF loop is started and stopped
 * with the drag as well, so an idle board does no per-frame work at all.
 */
export function useEdgePan(
  { state, dispatch, stateRef }: BoardStore,
  vpRef: RefObject<HTMLDivElement | null>,
  tracker: PointerTracker,
) {
  const dragging = state.drag.type !== 'none';

  useEffect(() => {
    if (!dragging) return;
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);

      const { edgePan, edgePanThreshold: thr, edgePanSpeed: speed } = stateRef.current.settings;
      const vp = vpRef.current;
      if (!edgePan || !vp || !tracker.inViewport.current || tracker.onUi.current) return;
      if (stateRef.current.drag.type === 'none') return;

      const { width, height } = vp.getBoundingClientRect();
      const { x, y } = tracker.pos.current;

      let dx = 0,
        dy = 0;
      if (x >= 0 && x < thr) dx = speed * (1 - x / thr);
      if (x <= width && x > width - thr) dx = -speed * (1 - (width - x) / thr);
      if (y >= 0 && y < thr) dy = speed * (1 - y / thr);
      if (y <= height && y > height - thr) dy = -speed * (1 - (height - y) / thr);

      if (dx || dy) dispatch({ type: 'PAN_BY', dx, dy });
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dragging, dispatch, stateRef, vpRef, tracker]);
}
