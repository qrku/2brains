'use client';

import { useEffect, type RefObject } from 'react';
import { pointerPos } from './pointer';
import type { BoardStore } from './useBoardStore';

/**
 * Feeds window-level mouse movement into the reducer for the duration of a drag.
 * Listeners live on `window`, not the viewport, so a drag survives the cursor leaving the board.
 */
export function useDragMachine(
  { dispatch, stateRef }: BoardStore,
  vpRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (stateRef.current.drag.type === 'none') return;
      dispatch({ type: 'DRAG_MOVE', pos: pointerPos(e, vpRef.current) });
    };
    const onUp = (e: MouseEvent) => {
      if (stateRef.current.drag.type === 'none') return;
      dispatch({ type: 'DRAG_END', pos: pointerPos(e, vpRef.current) });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dispatch, stateRef, vpRef]);
}
