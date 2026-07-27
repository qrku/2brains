'use client';

import { useEffect, useState } from 'react';
import { toC } from '@/entities/board';
import type { PointerTracker } from './usePointerTracker';
import type { BoardStore } from './useBoardStore';

/**
 * Board-wide keys. Everything here is suppressed while a node's text is being edited, so
 * Backspace deletes characters rather than the node.
 *
 * Returns whether Space is held — the viewport shows a grab cursor and treats LMB as a pan.
 */
export function useBoardHotkeys({ dispatch, stateRef }: BoardStore, tracker: PointerTracker): boolean {
  const [spacePan, setSpacePan] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never hijack keys meant for a focused field (frame search, settings inputs, node editor).
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

      const { editing, tool } = stateRef.current;

      if (e.key === ' ' && !editing) {
        e.preventDefault();
        setSpacePan(true);
      }
      if (editing) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        dispatch({ type: 'DELETE_SELECTION' });
        return;
      }

      if (e.key === 'Escape') {
        // First Escape drops back to the cursor tool; a second clears the selection.
        if (tool !== 'cursor') {
          dispatch({ type: 'SET_TOOL', tool: 'cursor' });
        } else {
          dispatch({ type: 'EDIT', id: null });
          dispatch({ type: 'SELECT', ids: [] });
          dispatch({ type: 'SELECT_EDGE', id: null });
        }
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;

      if (e.key.toLowerCase() === 'c' && stateRef.current.selected.length) {
        e.preventDefault();
        dispatch({ type: 'COPY' });
      }
      if (e.key.toLowerCase() === 'v' && stateRef.current.clipboard?.nodes.length) {
        e.preventDefault();
        // Paste under the cursor when it's over the board, otherwise offset from the original.
        const at = tracker.inViewport.current
          ? toC(tracker.pos.current.x, tracker.pos.current.y, stateRef.current.view)
          : null;
        dispatch({ type: 'PASTE', at });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpacePan(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dispatch, stateRef, tracker]);

  return spacePan;
}
