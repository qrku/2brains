'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';

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

export function ModulesStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { hydrated: false, enabled: [] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('prep_modules_v1');
      dispatch({ type: 'HYDRATE', enabled: raw ? JSON.parse(raw) : [] });
    } catch {
      dispatch({ type: 'HYDRATE', enabled: [] });
    }
  }, []);

  useEffect(() => {
    if (state.hydrated) {
      localStorage.setItem('prep_modules_v1', JSON.stringify(state.enabled));
    }
  }, [state.hydrated, state.enabled]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useModulesStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useModulesStore must be inside ModulesStoreProvider');
  return ctx;
}
