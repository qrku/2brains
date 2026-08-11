'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { UserPack } from './types';
import { wsKey } from '@/shared/lib/workspace';

const STORAGE_KEY = 'prep_user_packs_v1';

interface State {
  packs: UserPack[];
  hydrated: boolean;
}

type Action =
  | { type: 'HYDRATE'; packs: UserPack[] }
  | { type: 'ADD_PACK'; title: string; description: string }
  | { type: 'UPDATE_PACK'; id: string; title: string; description: string }
  | { type: 'DELETE_PACK'; id: string };

function uid() { return Math.random().toString(36).slice(2, 10); }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, packs: action.packs, hydrated: true };
    case 'ADD_PACK':
      return {
        ...state,
        packs: [
          { id: uid(), title: action.title, description: action.description, createdAt: new Date().toISOString() },
          ...state.packs,
        ],
      };
    case 'UPDATE_PACK':
      return {
        ...state,
        packs: state.packs.map((p) =>
          p.id === action.id ? { ...p, title: action.title, description: action.description } : p
        ),
      };
    case 'DELETE_PACK':
      return { ...state, packs: state.packs.filter((p) => p.id !== action.id) };
    default:
      return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

interface Props {
  /** Null until the workspace store hydrates; nothing is read or written while it is. */
  workspaceId: string | null;
  children: ReactNode;
}

export function UserPacksStoreProvider({ workspaceId, children }: Props) {
  const [state, dispatch] = useReducer(reducer, { packs: [], hydrated: false });

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const raw = localStorage.getItem(wsKey(STORAGE_KEY, workspaceId));
      dispatch({ type: 'HYDRATE', packs: raw ? JSON.parse(raw) : [] });
    } catch {
      dispatch({ type: 'HYDRATE', packs: [] });
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!state.hydrated || !workspaceId) return;
    localStorage.setItem(wsKey(STORAGE_KEY, workspaceId), JSON.stringify(state.packs));
  }, [state.packs, state.hydrated, workspaceId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useUserPacksStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserPacksStore must be inside UserPacksStoreProvider');
  return ctx;
}
