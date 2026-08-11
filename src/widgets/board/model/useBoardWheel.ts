'use client';

import { useEffect, type RefObject } from 'react';
import { viewportPoint } from './pointer';
import type { BoardStore } from './useBoardStore';
import type { PointerTracker } from './usePointerTracker';

const PINCH_ZOOM_STEP = 1.05;
const WHEEL_ZOOM_STEP = 1.15;

/**
 * Registered natively rather than via onWheel because the handler must call preventDefault(),
 * and React attaches wheel listeners as passive.
 */
export function useBoardWheel(
  { dispatch }: BoardStore,
  vpRef: RefObject<HTMLDivElement | null>,
  tracker: PointerTracker,
) {
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Over a floating panel (frame wheel, etc.) let the panel scroll natively — don't zoom/pan.
      if (tracker.onUi.current) return;
      e.preventDefault();
      const { x: mx, y: my } = viewportPoint(e, el);

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch and ctrl+wheel — fine-grained zoom.
        dispatch({
          type: 'ZOOM_AT',
          factor: e.deltaY < 0 ? PINCH_ZOOM_STEP : 1 / PINCH_ZOOM_STEP,
          mx,
          my,
        });
      } else if (Math.abs(e.deltaX) > 1 || Math.abs(e.deltaY) < 50) {
        // Two-finger scroll: small or horizontal deltas mean the user is panning, not zooming.
        dispatch({ type: 'PAN_BY', dx: -e.deltaX, dy: -e.deltaY });
      } else {
        // A real mouse wheel's coarse clicks — zoom.
        dispatch({
          type: 'ZOOM_AT',
          factor: e.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP,
          mx,
          my,
        });
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [dispatch, vpRef, tracker]);
}
