'use client';

import { useEffect, useReducer, useRef, type Dispatch, type RefObject } from 'react';
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

export function useBoardStore(): BoardStore {
  const { state: wsState } = useWorkspaceStore();
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // The workspace whose data is currently loaded into state — debounced saves always flush to
  // this, not to wsState.currentId, so a mid-debounce workspace switch can't leak one
  // workspace's edits into another's storage key.
  const boardWsId = useRef(wsState.currentId);
  const docTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!wsState.hydrated) return;
    const id = wsState.currentId;
    const doc = loadBoard(id);
    boardWsId.current = id;
    dispatch({
      type: 'LOAD',
      nodes: doc.nodes,
      edges: doc.edges,
      settings: loadBoardSettings(id),
      view: loadBoardView(id),
    });
  }, [wsState.hydrated, wsState.currentId]);

  const { ready, nodes, edges, view, settings } = state;

  useEffect(() => {
    if (!ready) return;
    if (docTimer.current) clearTimeout(docTimer.current);
    docTimer.current = setTimeout(() => saveBoard({ nodes, edges }, boardWsId.current), DOC_SAVE_MS);
  }, [nodes, edges, ready]);

  useEffect(() => {
    if (!ready) return;
    if (viewTimer.current) clearTimeout(viewTimer.current);
    viewTimer.current = setTimeout(() => saveBoardView(view, boardWsId.current), VIEW_SAVE_MS);
  }, [view, ready]);

  useEffect(() => {
    if (!ready) return;
    saveBoardSettings(settings, boardWsId.current);
  }, [settings, ready]);

  return { state, dispatch, stateRef };
}
