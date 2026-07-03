'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Problem, Difficulty, ProblemStatus, Pattern } from '@/entities/problem';
import { STATUS_CYCLE } from '@/entities/problem';

const STORAGE_KEY = 'prep_problems_v1';

interface State {
  problems: Problem[];
  hydrated: boolean;
}

type Action =
  | { type: 'HYDRATE'; problems: Problem[] }
  | {
      type: 'ADD_PROBLEM';
      title: string;
      url?: string;
      difficulty: Difficulty;
      status: ProblemStatus;
      patterns: Pattern[];
      note?: string;
    }
  | {
      type: 'UPDATE_PROBLEM';
      id: string;
      title: string;
      url?: string;
      difficulty: Difficulty;
      status: ProblemStatus;
      patterns: Pattern[];
      note?: string;
    }
  | { type: 'CYCLE_STATUS'; id: string }
  | { type: 'DELETE_PROBLEM'; id: string };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, problems: action.problems, hydrated: true };

    case 'ADD_PROBLEM':
      return {
        ...state,
        problems: [
          {
            id: uid(),
            title: action.title,
            url: action.url,
            difficulty: action.difficulty,
            status: action.status,
            patterns: action.patterns,
            note: action.note,
            createdAt: new Date().toISOString(),
          },
          ...state.problems,
        ],
      };

    case 'UPDATE_PROBLEM':
      return {
        ...state,
        problems: state.problems.map((p) =>
          p.id !== action.id
            ? p
            : {
                ...p,
                title: action.title,
                url: action.url,
                difficulty: action.difficulty,
                status: action.status,
                patterns: action.patterns,
                note: action.note,
              }
        ),
      };

    case 'CYCLE_STATUS':
      return {
        ...state,
        problems: state.problems.map((p) =>
          p.id === action.id ? { ...p, status: STATUS_CYCLE[p.status] } : p
        ),
      };

    case 'DELETE_PROBLEM':
      return { ...state, problems: state.problems.filter((p) => p.id !== action.id) };

    default:
      return state;
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function ProblemStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { problems: [], hydrated: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      dispatch({ type: 'HYDRATE', problems: raw ? JSON.parse(raw) : [] });
    } catch {
      dispatch({ type: 'HYDRATE', problems: [] });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.problems));
  }, [state.problems, state.hydrated]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useProblemStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProblemStore must be used within ProblemStoreProvider');
  return ctx;
}
