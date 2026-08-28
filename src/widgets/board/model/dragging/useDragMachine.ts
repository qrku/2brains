'use client';

import { useEffect, type RefObject } from 'react';
import { pointerPos } from './pointer';
import type { BoardStore } from '../useBoardStore';

/**
 * Feeds window-level pointer movement into the reducer for the duration of a drag.
 * Listeners live on `window`, not the viewport, so a drag survives the cursor leaving the board.
 *
 * `pointercancel` обрывает жест начисто: система забирает касание себе (звонок,
 * системный свайп от края, второй палец, начавший масштабирование) и `pointerup`
 * после этого уже не придёт — без отмены доска осталась бы в перетаскивании
 * навсегда.
 */
export function useDragMachine(
  { dispatch, stateRef }: BoardStore,
  vpRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (stateRef.current.drag.type === 'none') return;
      dispatch({ type: 'DRAG_MOVE', pos: pointerPos(e, vpRef.current) });
    };
    const onUp = (e: PointerEvent) => {
      if (stateRef.current.drag.type === 'none') return;
      dispatch({ type: 'DRAG_END', pos: pointerPos(e, vpRef.current) });
    };
    const onCancel = () => {
      if (stateRef.current.drag.type === 'none') return;
      dispatch({ type: 'DRAG_CANCEL' });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [dispatch, stateRef, vpRef]);
}
