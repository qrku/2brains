'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { uid } from '@/shared/lib/uid';
import { DEFAULT_WORKSPACE, type Workspace } from './types';

const STORAGE_KEY = 'prep_workspaces_v1';
const CURRENT_KEY = 'prep_workspace_current_v1';

interface WorkspaceState {
  hydrated: boolean;
  workspaces: Workspace[];
  currentId: string;
}

type Action =
  | { type: 'HYDRATE'; workspaces: Workspace[]; currentId: string }
  | { type: 'ADD'; name: string }
  | { type: 'SELECT'; id: string };

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'HYDRATE':
      return { hydrated: true, workspaces: action.workspaces, currentId: action.currentId };
    case 'ADD': {
      const ws: Workspace = { id: uid(), name: action.name };
      return { ...state, workspaces: [...state.workspaces, ws], currentId: ws.id };
    }
    case 'SELECT':
      return { ...state, currentId: action.id };
    default:
      return state;
  }
}

const Ctx = createContext<{ state: WorkspaceState; dispatch: React.Dispatch<Action> } | null>(null);

export function WorkspaceStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    hydrated: false,
    workspaces: [DEFAULT_WORKSPACE],
    currentId: DEFAULT_WORKSPACE.id,
  });

  useEffect(() => {
    try {
      const rawList = localStorage.getItem(STORAGE_KEY);
      const rawCurrent = localStorage.getItem(CURRENT_KEY);
      const workspaces: Workspace[] = rawList ? JSON.parse(rawList) : [DEFAULT_WORKSPACE];
      const currentId =
        rawCurrent && workspaces.some((w) => w.id === rawCurrent)
          ? rawCurrent
          : workspaces[0]?.id ?? DEFAULT_WORKSPACE.id;
      dispatch({ type: 'HYDRATE', workspaces, currentId });
    } catch {
      dispatch({ type: 'HYDRATE', workspaces: [DEFAULT_WORKSPACE], currentId: DEFAULT_WORKSPACE.id });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspaces));
    localStorage.setItem(CURRENT_KEY, state.currentId);
  }, [state.hydrated, state.workspaces, state.currentId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useWorkspaceStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspaceStore must be inside WorkspaceStoreProvider');
  return ctx;
}
