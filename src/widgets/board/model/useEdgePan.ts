'use client';

import { useEffect, type RefObject } from 'react';
import type { PointerTracker } from './usePointerTracker';
import type { BoardStore } from './useBoardStore';

/**
 * Scrolls the board when the cursor lingers near a viewport edge, so a node can be dragged
 * beyond the visible area. Runs off rAF rather than mousemove — panning must continue while
 * the cursor is held still.
 */
export function useEdgePan(
  { dispatch, stateRef }: BoardStore,
  vpRef: RefObject<HTMLDivElement | null>,
  tracker: PointerTracker,
) {
  useEffect(() => {
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);

      const { edgePan, edgePanThreshold: thr, edgePanSpeed: speed } = stateRef.current.settings;
      const vp = vpRef.current;
      if (!edgePan || !vp || !tracker.inViewport.current || tracker.onUi.current) return;

      const { width, height } = vp.getBoundingClientRect();
      const { x, y } = tracker.pos.current;

      let dx = 0, dy = 0;
      if (x >= 0 && x < thr)               dx =  speed * (1 - x / thr);
      if (x <= width && x > width - thr)   dx = -speed * (1 - (width - x) / thr);
      if (y >= 0 && y < thr)               dy =  speed * (1 - y / thr);
      if (y <= height && y > height - thr) dy = -speed * (1 - (height - y) / thr);

      if (dx || dy) dispatch({ type: 'PAN_BY', dx, dy });
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dispatch, stateRef, vpRef, tracker]);
}
