'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Experience } from './types';
import { wsKey } from '@/shared/lib/workspace';

const STORAGE_KEY = 'prep_experience_v1';

interface State {
  experiences: Experience[];
  hydrated: boolean;
}

type Action =
  | { type: 'HYDRATE'; experiences: Experience[] }
  | { type: 'ADD_EXPERIENCE'; title: string; period?: string }
  | { type: 'DELETE_EXPERIENCE'; id: string }
  | { type: 'UPDATE_EXPERIENCE'; id: string; title?: string; period?: string | null }
  | { type: 'ADD_POINT'; experienceId: string; text: string }
  | { type: 'UPDATE_POINT'; experienceId: string; pointId: string; text: string }
  | { type: 'DELETE_POINT'; experienceId: string; pointId: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, experiences: action.experiences, hydrated: true };

    case 'ADD_EXPERIENCE':
      return {
        ...state,
        experiences: [
          {
            id: uid(),
            title: action.title,
            period: action.period,
            points: [],
            createdAt: new Date().toISOString(),
          },
          ...state.experiences,
        ],
      };

    case 'DELETE_EXPERIENCE':
      return { ...state, experiences: state.experiences.filter((e) => e.id !== action.id) };

    case 'UPDATE_EXPERIENCE':
      return {
        ...state,
        experiences: state.experiences.map((e) =>
          e.id !== action.id
            ? e
            : {
                ...e,
                title: action.title ?? e.title,
                period: action.period === null ? undefined : (action.period ?? e.period),
              }
        ),
      };

    case 'ADD_POINT':
      return {
        ...state,
        experiences: state.experiences.map((e) =>
          e.id !== action.experienceId
            ? e
            : { ...e, points: [...e.points, { id: uid(), text: action.text }] }
        ),
      };

    case 'UPDATE_POINT':
      return {
        ...state,
        experiences: state.experiences.map((e) =>
          e.id !== action.experienceId
            ? e
            : {
                ...e,
                points: e.points.map((p) =>
                  p.id === action.pointId ? { ...p, text: action.text } : p
                ),
              }
        ),
      };

    case 'DELETE_POINT':
      return {
        ...state,
        experiences: state.experiences.map((e) =>
          e.id !== action.experienceId
            ? e
            : { ...e, points: e.points.filter((p) => p.id !== action.pointId) }
        ),
      };

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

export function ExperienceStoreProvider({ workspaceId, children }: Props) {
  const [state, dispatch] = useReducer(reducer, { experiences: [], hydrated: false });

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const raw = localStorage.getItem(wsKey(STORAGE_KEY, workspaceId));
      dispatch({ type: 'HYDRATE', experiences: raw ? JSON.parse(raw) : [] });
    } catch {
      dispatch({ type: 'HYDRATE', experiences: [] });
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!state.hydrated || !workspaceId) return;
    localStorage.setItem(wsKey(STORAGE_KEY, workspaceId), JSON.stringify(state.experiences));
  }, [state.experiences, state.hydrated, workspaceId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useExperienceStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useExperienceStore must be used within ExperienceStoreProvider');
  return ctx;
}
