'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/entities/workspace';
import {
  DEFAULT_BOARD_NAME,
  deleteBoardData,
  loadBoardList,
  loadCurrentBoardId,
  saveBoardList,
  saveCurrentBoardId,
  type BoardMeta,
} from '@/entities/board';
import { uid } from '@/shared/lib/uid';

export interface BoardsStore {
  hydrated: boolean;
  boards: BoardMeta[];
  current: BoardMeta | null;
  select: (id: string) => void;
  create: () => void;
  rename: (id: string, name: string) => void;
  /** Возвращает `false`, если удалить нельзя — например, доска в воркспейсе последняя. */
  remove: (id: string) => boolean;
}

interface State {
  hydrated: boolean;
  boards: BoardMeta[];
  currentId: string | null;
}

/** "Доска 2", "Доска 3", … — the first free number, so deleting one frees its name again. */
function nextName(boards: BoardMeta[]): string {
  for (let i = boards.length + 1; ; i++) {
    const name = `${DEFAULT_BOARD_NAME} ${i}`;
    if (!boards.some((b) => b.name === name)) return name;
  }
}

/**
 * The workspace's list of boards and which one is open.
 *
 * Both live in localStorage and are written straight from the handlers rather than from an
 * effect: an untouched workspace must keep *no* saved list, which is how `countBoards` tells
 * "never used the board" apart from "has one board".
 */
export function useBoards(): BoardsStore {
  const { state: wsState } = useWorkspaceStore();
  const [state, setState] = useState<State>({ hydrated: false, boards: [], currentId: null });

  useEffect(() => {
    if (!wsState.hydrated) return;
    const boards = loadBoardList(wsState.currentId);
    setState({ hydrated: true, boards, currentId: loadCurrentBoardId(wsState.currentId, boards) });
  }, [wsState.hydrated, wsState.currentId]);

  const wsId = wsState.currentId;
  const { boards, currentId } = state;

  // Writes and id generation stay out of the setState updaters: those run twice under
  // StrictMode, which would mint two ids and persist a list the state never adopted.

  const select = useCallback(
    (id: string) => {
      if (id === currentId || !boards.some((b) => b.id === id)) return;
      saveCurrentBoardId(id, wsId);
      setState((s) => ({ ...s, currentId: id }));
    },
    [boards, currentId, wsId],
  );

  const create = useCallback(() => {
    const board: BoardMeta = {
      id: uid(),
      name: nextName(boards),
      createdAt: new Date().toISOString(),
    };
    const next = [...boards, board];
    saveBoardList(next, wsId);
    saveCurrentBoardId(board.id, wsId);
    setState((s) => ({ ...s, boards: next, currentId: board.id }));
  }, [boards, wsId]);

  const rename = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const next = boards.map((b) => (b.id === id ? { ...b, name: trimmed } : b));
      saveBoardList(next, wsId);
      setState((s) => ({ ...s, boards: next }));
    },
    [boards, wsId],
  );

  const remove = useCallback(
    (id: string) => {
      // A workspace always keeps at least one board — there'd be nothing to draw on otherwise.
      if (boards.length < 2 || !boards.some((b) => b.id === id)) return false;

      const next = boards.filter((b) => b.id !== id);
      const nextCurrent = currentId === id ? next[0].id : currentId;
      saveBoardList(next, wsId);
      if (nextCurrent !== currentId) saveCurrentBoardId(nextCurrent!, wsId);
      deleteBoardData(wsId, id);
      setState((s) => ({ ...s, boards: next, currentId: nextCurrent }));
      return true;
    },
    [boards, currentId, wsId],
  );

  return {
    hydrated: state.hydrated,
    boards: state.boards,
    current: boards.find((b) => b.id === currentId) ?? null,
    select,
    create,
    rename,
    remove,
  };
}
