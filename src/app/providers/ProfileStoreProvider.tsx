'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { DEFAULT_PROFILE, type Profile } from '@/entities/profile';

// The profile is the person using the app, not workspace data — it stays outside the
// per-workspace key namespace so the same nickname follows every workspace.
const STORAGE_KEY = 'prep_profile_v1';

interface State {
  profile: Profile;
  hydrated: boolean;
}

type Action =
  | { type: 'HYDRATE'; profile: Profile }
  | { type: 'UPDATE'; profile: Profile };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE': return { profile: action.profile, hydrated: true };
    case 'UPDATE':  return { ...state, profile: action.profile };
    default:        return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function ProfileStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { profile: DEFAULT_PROFILE, hydrated: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      dispatch({ type: 'HYDRATE', profile: raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE });
    } catch {
      dispatch({ type: 'HYDRATE', profile: DEFAULT_PROFILE });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
  }, [state.profile, state.hydrated]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useProfileStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfileStore must be inside ProfileStoreProvider');
  return ctx;
}
