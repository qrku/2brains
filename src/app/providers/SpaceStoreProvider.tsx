'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { SpaceNode, SpaceState, SpaceAction } from '@/entities/space';
import { useWorkspaceStore } from './WorkspaceStoreProvider';
import { wsKey } from '@/shared/lib/workspace';

const NODES_KEY = 'space_nodes_v1';
const META_KEY  = 'space_meta_v1';

function reducer(state: SpaceState, action: SpaceAction): SpaceState {
  switch (action.type) {
    case 'HYDRATE':
      return { hydrated: true, nodes: action.nodes, expanded: action.expanded, openFileId: action.openFileId };

    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.node] };

    case 'DELETE_NODE': {
      const remove = new Set([action.id, ...action.descendants]);
      return { ...state, nodes: state.nodes.filter((n) => !remove.has(n.id)) };
    }

    case 'RENAME_NODE':
      return { ...state, nodes: state.nodes.map((n) => n.id === action.id ? { ...n, name: action.name } : n) };

    case 'OPEN_FILE':
      return { ...state, openFileId: action.id };

    case 'TOGGLE_FOLDER': {
      const on = state.expanded.includes(action.id);
      return { ...state, expanded: on ? state.expanded.filter((x) => x !== action.id) : [...state.expanded, action.id] };
    }

    default:
      return state;
  }
}

const Ctx = createContext<{ state: SpaceState; dispatch: React.Dispatch<SpaceAction> } | null>(null);

export function SpaceStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { hydrated: false, nodes: [], openFileId: null, expanded: [] });
  const { state: wsState } = useWorkspaceStore();

  useEffect(() => {
    if (!wsState.hydrated) return;
    try {
      const nodes = JSON.parse(localStorage.getItem(wsKey(NODES_KEY, wsState.currentId)) ?? '[]') as SpaceNode[];
      const meta  = JSON.parse(localStorage.getItem(wsKey(META_KEY, wsState.currentId)) ?? '{}') as { expanded?: string[]; openFileId?: string };
      dispatch({ type: 'HYDRATE', nodes, expanded: meta.expanded ?? [], openFileId: meta.openFileId ?? null });
    } catch {
      dispatch({ type: 'HYDRATE', nodes: [], expanded: [], openFileId: null });
    }
  }, [wsState.hydrated, wsState.currentId]);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(wsKey(NODES_KEY, wsState.currentId), JSON.stringify(state.nodes));
    localStorage.setItem(wsKey(META_KEY, wsState.currentId),  JSON.stringify({ expanded: state.expanded, openFileId: state.openFileId }));
  }, [state.hydrated, state.nodes, state.expanded, state.openFileId, wsState.currentId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useSpaceStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSpaceStore must be inside SpaceStoreProvider');
  return ctx;
}

// Content helpers — read/write directly to avoid putting large strings in React state.
// Callers must pass the current workspace id (from useWorkspaceStore) so content stays isolated per workspace.
export const spaceReadContent = (id: string, workspaceId: string): string => {
  try { return localStorage.getItem(wsKey(`space_file_${id}`, workspaceId)) ?? ''; } catch { return ''; }
};
export const spaceSaveContent = (id: string, text: string, workspaceId: string) => {
  try { localStorage.setItem(wsKey(`space_file_${id}`, workspaceId), text); } catch {}
};
export const spaceDeleteContent = (id: string, workspaceId: string) => {
  try { localStorage.removeItem(wsKey(`space_file_${id}`, workspaceId)); } catch {}
};
