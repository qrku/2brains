'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { wsKey } from '@/shared/lib/workspace';

const STORAGE_KEY = 'prep_modules_v1';

interface ModulesState {
  hydrated: boolean;
  enabled: string[];
}

type Action =
  | { type: 'HYDRATE'; enabled: string[] }
  | { type: 'TOGGLE'; id: string };

function reducer(state: ModulesState, action: Action): ModulesState {
  switch (action.type) {
    case 'HYDRATE':
      return { hydrated: true, enabled: action.enabled };
    case 'TOGGLE': {
      const on = state.enabled.includes(action.id);
      return {
        ...state,
        enabled: on
          ? state.enabled.filter((x) => x !== action.id)
          : [...state.enabled, action.id],
      };
    }
    default:
      return state;
  }
}

const Ctx = createContext<{ state: ModulesState; dispatch: React.Dispatch<Action> } | null>(null);

interface Props {
  /** Null until the workspace store hydrates; nothing is read or written while it is. */
  workspaceId: string | null;
  children: ReactNode;
}

export function ModulesStoreProvider({ workspaceId, children }: Props) {
  const [state, dispatch] = useReducer(reducer, { hydrated: false, enabled: [] });

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const raw = localStorage.getItem(wsKey(STORAGE_KEY, workspaceId));
      dispatch({ type: 'HYDRATE', enabled: raw ? JSON.parse(raw) : [] });
    } catch {
      dispatch({ type: 'HYDRATE', enabled: [] });
    }
  }, [workspaceId]);

  useEffect(() => {
    if (state.hydrated && workspaceId) {
      localStorage.setItem(wsKey(STORAGE_KEY, workspaceId), JSON.stringify(state.enabled));
    }
  }, [state.hydrated, state.enabled, workspaceId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useModulesStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useModulesStore must be inside ModulesStoreProvider');
  return ctx;
}
