'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { Section, Topic } from '@/entities/section';
import { loadStorage, saveStorage } from '@/shared/lib/storage';
import { uid } from '@/shared/lib/uid';

// ─── State ───────────────────────────────────────────────────────────────────

export type Filter = 'all' | 'missing' | 'high';

interface PrepState {
  sections: Section[];
  doneIds: Set<string>;
  filter: Filter;
  openIds: Set<string>;
  hydrated: boolean;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'HYDRATE'; sections: Section[]; doneIds: string[] }
  | { type: 'TOGGLE_TOPIC'; topicId: string }
  | { type: 'ADD_TOPIC'; sectionId: string; name: string; priority?: 'high' | 'med' }
  | { type: 'DELETE_TOPIC'; sectionId: string; topicId: string }
  | { type: 'ADD_SECTION'; name: string }
  | { type: 'DELETE_SECTION'; sectionId: string }
  | { type: 'SET_FILTER'; filter: Filter }
  | { type: 'TOGGLE_OPEN'; sectionId: string };

function reducer(state: PrepState, action: Action): PrepState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        sections: action.sections,
        doneIds: new Set(action.doneIds),
        hydrated: true,
      };

    case 'TOGGLE_TOPIC': {
      const doneIds = new Set(state.doneIds);
      doneIds.has(action.topicId)
        ? doneIds.delete(action.topicId)
        : doneIds.add(action.topicId);
      return { ...state, doneIds };
    }

    case 'ADD_TOPIC': {
      const topic: Topic = {
        id: uid(),
        n: action.name,
        ...(action.priority && { p: action.priority }),
      };
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.sectionId ? { ...s, topics: [...s.topics, topic] } : s,
        ),
      };
    }

    case 'DELETE_TOPIC': {
      const doneIds = new Set(state.doneIds);
      doneIds.delete(action.topicId);
      return {
        ...state,
        doneIds,
        sections: state.sections.map((s) =>
          s.id === action.sectionId
            ? { ...s, topics: s.topics.filter((t) => t.id !== action.topicId) }
            : s,
        ),
      };
    }

    case 'ADD_SECTION': {
      const section: Section = { id: uid(), name: action.name, topics: [] };
      const openIds = new Set(state.openIds);
      openIds.add(section.id);
      return { ...state, sections: [...state.sections, section], openIds };
    }

    case 'DELETE_SECTION': {
      const sec = state.sections.find((s) => s.id === action.sectionId);
      const doneIds = new Set(state.doneIds);
      sec?.topics.forEach((t) => doneIds.delete(t.id));
      const openIds = new Set(state.openIds);
      openIds.delete(action.sectionId);
      return {
        ...state,
        doneIds,
        openIds,
        sections: state.sections.filter((s) => s.id !== action.sectionId),
      };
    }

    case 'SET_FILTER':
      return { ...state, filter: action.filter };

    case 'TOGGLE_OPEN': {
      const openIds = new Set(state.openIds);
      openIds.has(action.sectionId)
        ? openIds.delete(action.sectionId)
        : openIds.add(action.sectionId);
      return { ...state, openIds };
    }

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface PrepContextValue {
  state: PrepState;
  dispatch: React.Dispatch<Action>;
}

const PrepContext = createContext<PrepContextValue | null>(null);

export function usePrepStore() {
  const ctx = useContext(PrepContext);
  if (!ctx) throw new Error('usePrepStore must be inside PrepStoreProvider');
  return ctx;
}

// ─── Selectors ───────────────────────────────────────────────────────────────

export function useStats() {
  const { state } = usePrepStore();
  return useMemo(() => {
    let tot = 0,
      cov = 0;
    state.sections.forEach((s) =>
      s.topics.forEach((t) => {
        tot++;
        if (state.doneIds.has(t.id)) cov++;
      }),
    );
    const pct = tot ? Math.round((cov / tot) * 100) : 0;
    return { tot, cov, pct };
  }, [state.sections, state.doneIds]);
}

export function useFilteredSections() {
  const { state } = usePrepStore();
  return useMemo(() => {
    if (state.filter === 'all') return state.sections;
    return state.sections
      .map((s) => ({
        ...s,
        topics: s.topics.filter((t) => {
          const done = state.doneIds.has(t.id);
          if (state.filter === 'missing') return !done;
          if (state.filter === 'high') return !done && t.p === 'high';
          return true;
        }),
      }))
      .filter((s) => s.topics.length > 0);
  }, [state.sections, state.doneIds, state.filter]);
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface Props {
  packId: string;
  defaultSections: Section[];
  defaultDoneIds: string[];
  children: ReactNode;
}

export function PrepStoreProvider({ packId, defaultSections, defaultDoneIds, children }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    sections: defaultSections,
    doneIds: new Set<string>(),
    filter: 'all',
    openIds: new Set<string>(),
    hydrated: false,
  });

  useEffect(() => {
    const { sections, doneIds } = loadStorage(packId, defaultSections, defaultDoneIds);
    dispatch({ type: 'HYDRATE', sections, doneIds });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.hydrated) return;
    saveStorage(packId, state.sections, Array.from(state.doneIds));
  }, [state.sections, state.doneIds, state.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PrepContext.Provider value={{ state, dispatch }}>
      {children}
    </PrepContext.Provider>
  );
}
