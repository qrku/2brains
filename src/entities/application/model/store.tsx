'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Application, ApplicationStatus } from './types';
import { wsKey } from '@/shared/lib/workspace';

const STORAGE_KEY = 'prep_applications_v1';

interface State {
  applications: Application[];
  hydrated: boolean;
}

type Action =
  | { type: 'HYDRATE'; applications: Application[] }
  | {
      type: 'ADD_APPLICATION';
      company: string;
      position: string;
      url?: string;
      status: ApplicationStatus;
      note?: string;
    }
  | {
      type: 'UPDATE_APPLICATION';
      id: string;
      company: string;
      position: string;
      url?: string;
      status: ApplicationStatus;
      note?: string;
    }
  | { type: 'DELETE_APPLICATION'; id: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, applications: action.applications, hydrated: true };

    case 'ADD_APPLICATION':
      return {
        ...state,
        applications: [
          {
            id: uid(),
            company: action.company,
            position: action.position,
            url: action.url,
            status: action.status,
            note: action.note,
            createdAt: new Date().toISOString(),
          },
          ...state.applications,
        ],
      };

    case 'UPDATE_APPLICATION':
      return {
        ...state,
        applications: state.applications.map((a) =>
          a.id !== action.id
            ? a
            : {
                ...a,
                company: action.company,
                position: action.position,
                url: action.url,
                status: action.status,
                note: action.note,
              }
        ),
      };

    case 'DELETE_APPLICATION':
      return { ...state, applications: state.applications.filter((a) => a.id !== action.id) };

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

export function ApplicationStoreProvider({ workspaceId, children }: Props) {
  const [state, dispatch] = useReducer(reducer, { applications: [], hydrated: false });

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const raw = localStorage.getItem(wsKey(STORAGE_KEY, workspaceId));
      dispatch({ type: 'HYDRATE', applications: raw ? JSON.parse(raw) : [] });
    } catch {
      dispatch({ type: 'HYDRATE', applications: [] });
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!state.hydrated || !workspaceId) return;
    localStorage.setItem(wsKey(STORAGE_KEY, workspaceId), JSON.stringify(state.applications));
  }, [state.applications, state.hydrated, workspaceId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useApplicationStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApplicationStore must be used within ApplicationStoreProvider');
  return ctx;
}
