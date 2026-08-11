'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { SpaceState, SpaceAction } from './types';
import { spaceReadMeta, spaceReadNodes, spaceSaveMeta, spaceSaveNodes } from '../api/storage';

function reducer(state: SpaceState, action: SpaceAction): SpaceState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        hydrated: true,
        nodes: action.nodes,
        expanded: action.expanded,
        openFileId: action.openFileId,
      };

    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.node] };

    case 'MOVE_NODE': {
      // Reparent; a no-op guard keeps a stray self-drop from making a node its own parent.
      if (action.id === action.parentId) return state;
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.id ? { ...n, parentId: action.parentId } : n,
        ),
      };
    }

    case 'DELETE_NODE': {
      const remove = new Set([action.id, ...action.descendants]);
      return { ...state, nodes: state.nodes.filter((n) => !remove.has(n.id)) };
    }

    case 'RENAME_NODE':
      return {
        ...state,
        nodes: state.nodes.map((n) => (n.id === action.id ? { ...n, name: action.name } : n)),
      };

    case 'OPEN_FILE':
      return { ...state, openFileId: action.id };

    case 'TOGGLE_FOLDER': {
      const on = state.expanded.includes(action.id);
      return {
        ...state,
        expanded: on
          ? state.expanded.filter((x) => x !== action.id)
          : [...state.expanded, action.id],
      };
    }

    default:
      return state;
  }
}

const Ctx = createContext<{ state: SpaceState; dispatch: React.Dispatch<SpaceAction> } | null>(
  null,
);

interface Props {
  /** Null until the workspace store hydrates; nothing is read or written while it is. */
  workspaceId: string | null;
  children: ReactNode;
}

export function SpaceStoreProvider({ workspaceId, children }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    hydrated: false,
    nodes: [],
    openFileId: null,
    expanded: [],
  });

  useEffect(() => {
    if (!workspaceId) return;
    const { expanded, openFileId } = spaceReadMeta(workspaceId);
    dispatch({ type: 'HYDRATE', nodes: spaceReadNodes(workspaceId), expanded, openFileId });
  }, [workspaceId]);

  useEffect(() => {
    if (!state.hydrated || !workspaceId) return;
    spaceSaveNodes(state.nodes, workspaceId);
    spaceSaveMeta({ expanded: state.expanded, openFileId: state.openFileId }, workspaceId);
  }, [state.hydrated, state.nodes, state.expanded, state.openFileId, workspaceId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useSpaceStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSpaceStore must be inside SpaceStoreProvider');
  return ctx;
}
