'use client';

import { useCallback, useEffect, useReducer, useRef, type Dispatch, type RefObject } from 'react';
import { useWorkspaceStore } from '@/app/providers/WorkspaceStoreProvider';
import {
  loadBoard, loadBoardSettings, loadBoardView, saveBoard, saveBoardSettings, saveBoardView,
} from '@/entities/board';
import { boardReducer, initialBoardState } from './boardReducer';
import type { BoardAction, BoardState } from './types';

const DOC_SAVE_MS  = 500;
const VIEW_SAVE_MS = 300;

export interface BoardStore {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
  /**
   * The committed state, readable from imperative handlers (window listeners, rAF loops) that
   * are registered once and would otherwise close over a stale render's values. Handlers use it
   * only to decide *what* to dispatch — never to compute the next state, which is the reducer's
   * job — so a one-event lag can at worst cost a no-op dispatch that React bails out of.
   */
  stateRef: RefObject<BoardState>;
}

/** Loads and persists one board; pass `null` while the board list is still hydrating. */
export function useBoardStore(boardId: string | null): BoardStore {
  const { state: wsState } = useWorkspaceStore();
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // Which workspace and board the state in hand belongs to. Debounced saves always flush to this,
  // not to the current selection, so switching mid-debounce can't leak one board's edits into
  // another's storage key.
  const target  = useRef<{ wsId: string; boardId: string | null }>({ wsId: wsState.currentId, boardId });
  const docTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Writes the committed doc out now and cancels the pending debounce. */
  const flush = useCallback(() => {
    if (docTimer.current)  { clearTimeout(docTimer.current);  docTimer.current = null; }
    if (viewTimer.current) { clearTimeout(viewTimer.current); viewTimer.current = null; }

    const s = stateRef.current;
    const { wsId, boardId: id } = target.current;
    // Before the first LOAD the state is the empty initial one — writing it would erase a board.
    if (!s.ready || !id) return;
    saveBoard({ nodes: s.nodes, edges: s.edges }, wsId, id);
    saveBoardView(s.view, wsId, id);
  }, []);

  useEffect(() => {
    if (!wsState.hydrated || !boardId) return;

    // Leaving the previous board: its last half-second of edits is still only in memory.
    flush();

    const wsId = wsState.currentId;
    const doc = loadBoard(wsId, boardId);
    target.current = { wsId, boardId };
    dispatch({
      type: 'LOAD',
      nodes: doc.nodes,
      edges: doc.edges,
      settings: loadBoardSettings(wsId, boardId),
      view: loadBoardView(wsId, boardId),
    });
  }, [wsState.hydrated, wsState.currentId, boardId, flush]);

  // Unmounting (navigating off the board) must not drop pending edits either.
  useEffect(() => flush, [flush]);

  const { ready, nodes, edges, view, settings } = state;

  useEffect(() => {
    if (!ready) return;
    if (docTimer.current) clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => {
      const { wsId, boardId: id } = target.current;
      if (id) saveBoard({ nodes, edges }, wsId, id);
    }, DOC_SAVE_MS);
  }, [nodes, edges, ready]);

  useEffect(() => {
    if (!ready) return;
    if (viewTimer.current) clearTimeout(viewTimer.current);
    viewTimer.current = setTimeout(() => {
      const { wsId, boardId: id } = target.current;
      if (id) saveBoardView(view, wsId, id);
    }, VIEW_SAVE_MS);
  }, [view, ready]);

  useEffect(() => {
    if (!ready) return;
    const { wsId, boardId: id } = target.current;
    if (id) saveBoardSettings(settings, wsId, id);
  }, [settings, ready]);

  return { state, dispatch, stateRef };
}
