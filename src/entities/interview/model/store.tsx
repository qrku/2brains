'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from 'react';
import type { Interview, Question } from './types';
import { uid } from '@/shared/lib/uid';
import { wsKey } from '@/shared/lib/workspace';

const LS_KEY = 'prep_interviews_v1';

// ─── State ───────────────────────────────────────────────────────────────────

interface InterviewState {
  interviews: Interview[];
  hydrated: boolean;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'HYDRATE'; interviews: Interview[] }
  | { type: 'ADD_INTERVIEW'; title: string }
  | { type: 'DELETE_INTERVIEW'; id: string }
  | { type: 'UPDATE_TITLE'; id: string; title: string }
  | { type: 'ADD_QUESTION'; interviewId: string; question: string; answer: string }
  | { type: 'UPDATE_QUESTION'; interviewId: string; questionId: string; question?: string; answer?: string }
  | { type: 'DELETE_QUESTION'; interviewId: string; questionId: string };

function mapInterview(
  interviews: Interview[],
  id: string,
  fn: (i: Interview) => Interview,
) {
  return interviews.map((i) => (i.id === id ? fn(i) : i));
}

function reducer(state: InterviewState, action: Action): InterviewState {
  switch (action.type) {
    case 'HYDRATE':
      return { interviews: action.interviews, hydrated: true };

    case 'ADD_INTERVIEW': {
      const interview: Interview = {
        id: uid(),
        title: action.title,
        createdAt: new Date().toISOString(),
        questions: [],
      };
      return { ...state, interviews: [...state.interviews, interview] };
    }

    case 'DELETE_INTERVIEW':
      return {
        ...state,
        interviews: state.interviews.filter((i) => i.id !== action.id),
      };

    case 'UPDATE_TITLE':
      return {
        ...state,
        interviews: mapInterview(state.interviews, action.id, (i) => ({
          ...i,
          title: action.title,
        })),
      };

    case 'ADD_QUESTION': {
      const q: Question = {
        id: uid(),
        question: action.question,
        answer: action.answer,
      };
      return {
        ...state,
        interviews: mapInterview(state.interviews, action.interviewId, (i) => ({
          ...i,
          questions: [...i.questions, q],
        })),
      };
    }

    case 'UPDATE_QUESTION':
      return {
        ...state,
        interviews: mapInterview(state.interviews, action.interviewId, (i) => ({
          ...i,
          questions: i.questions.map((q) =>
            q.id === action.questionId
              ? {
                  ...q,
                  ...(action.question !== undefined && { question: action.question }),
                  ...(action.answer !== undefined && { answer: action.answer }),
                }
              : q,
          ),
        })),
      };

    case 'DELETE_QUESTION':
      return {
        ...state,
        interviews: mapInterview(state.interviews, action.interviewId, (i) => ({
          ...i,
          questions: i.questions.filter((q) => q.id !== action.questionId),
        })),
      };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface InterviewContextValue {
  state: InterviewState;
  dispatch: React.Dispatch<Action>;
}

const InterviewContext = createContext<InterviewContextValue | null>(null);

export function useInterviewStore() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterviewStore must be inside InterviewStoreProvider');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface Props {
  /** Null until the workspace store hydrates; nothing is read or written while it is. */
  workspaceId: string | null;
  children: ReactNode;
}

export function InterviewStoreProvider({ workspaceId, children }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    interviews: [],
    hydrated: false,
  });

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const stored = localStorage.getItem(wsKey(LS_KEY, workspaceId));
      dispatch({
        type: 'HYDRATE',
        interviews: stored ? (JSON.parse(stored) as Interview[]) : [],
      });
    } catch {
      dispatch({ type: 'HYDRATE', interviews: [] });
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!state.hydrated || !workspaceId) return;
    try {
      localStorage.setItem(wsKey(LS_KEY, workspaceId), JSON.stringify(state.interviews));
    } catch {}
  }, [state.interviews, state.hydrated, workspaceId]);

  return (
    <InterviewContext.Provider value={{ state, dispatch }}>
      {children}
    </InterviewContext.Provider>
  );
}
