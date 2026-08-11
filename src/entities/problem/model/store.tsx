'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useSubscription } from 'urql';
import type { Problem, Difficulty, ProblemStatus, Pattern } from './types';
import {
  PROBLEMS_QUERY,
  PROBLEMS_CHANGED_SUBSCRIPTION,
  CREATE_PROBLEM,
  UPDATE_PROBLEM,
  CYCLE_PROBLEM_STATUS,
  DELETE_PROBLEM,
  type GqlProblem,
  fromGqlProblem,
  toGqlInput,
} from '../api/problems';

/**
 * Первый стор, переехавший с localStorage на GraphQL.
 *
 * Наружу отдаётся тот же контракт `{ state, dispatch }`, что и у остальных сторов,
 * поэтому потребители (ProblemList, ProblemCard, ProblemModal, ProfileStats) не менялись.
 * Внутри dispatch больше не редьюсер — это вызов мутации; состояние приходит с сервера.
 */

interface State {
  problems: Problem[];
  hydrated: boolean;
}

type Action =
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

const Ctx = createContext<{ state: State; dispatch: (action: Action) => void } | null>(null);

interface Props {
  /** Null until the workspace store hydrates; the query and subscription stay paused while it is. */
  workspaceId: string | null;
  children: ReactNode;
}

export function ProblemStoreProvider({ workspaceId: currentId, children }: Props) {
  const pause = currentId === null;
  // urql still wants a defined variable while paused.
  const workspaceId = currentId ?? '';

  const [result] = useQuery<{ problems: GqlProblem[] }>({
    query: PROBLEMS_QUERY,
    variables: { workspaceId },
    pause,
  });

  /**
   * Живой канал: сервер пушит весь список задач воркспейса при любом изменении,
   * в том числе сделанном в другой вкладке. Держим отдельно от результата запроса
   * и помечаем воркспейсом, иначе при переключении воркспейса на экране на мгновение
   * останутся задачи предыдущего.
   */
  const [live, setLive] = useState<{ workspaceId: string; problems: GqlProblem[] } | null>(null);

  useSubscription<{ problemsChanged: GqlProblem[] }>(
    { query: PROBLEMS_CHANGED_SUBSCRIPTION, variables: { workspaceId }, pause },
    (_prev, data) => {
      setLive({ workspaceId, problems: data.problemsChanged });
      return data;
    },
  );

  const [, createProblem] = useMutation(CREATE_PROBLEM);
  const [, updateProblem] = useMutation(UPDATE_PROBLEM);
  const [, cycleStatus] = useMutation(CYCLE_PROBLEM_STATUS);
  const [, deleteProblem] = useMutation(DELETE_PROBLEM);

  const source =
    live?.workspaceId === workspaceId ? live.problems : (result.data?.problems ?? []);

  const state: State = {
    problems: source.map(fromGqlProblem),
    hydrated: !pause && !result.fetching && result.data !== undefined,
  };

  const dispatch = (action: Action) => {
    switch (action.type) {
      case 'ADD_PROBLEM':
        createProblem({ workspaceId, input: toGqlInput(action) });
        break;
      case 'UPDATE_PROBLEM':
        updateProblem({ workspaceId, id: action.id, input: toGqlInput(action) });
        break;
      case 'CYCLE_STATUS':
        cycleStatus({ workspaceId, id: action.id });
        break;
      case 'DELETE_PROBLEM':
        deleteProblem({ workspaceId, id: action.id });
        break;
    }
  };

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useProblemStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProblemStore must be used within ProblemStoreProvider');
  return ctx;
}
