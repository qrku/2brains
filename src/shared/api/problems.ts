import type { Problem, Difficulty, ProblemStatus, Pattern } from '@/entities/problem';

/**
 * Документы и мапперы для домена задач.
 *
 * В схеме enum'ы записаны в UPPER_SNAKE (конвенция GraphQL), а типы фронта используют
 * kebab-case ('two-pointers'). Конвертация живёт здесь, чтобы дальше по коду ходили
 * только доменные типы из @/entities/problem.
 */

/** Форма Problem, как её отдаёт сервер: enum'ы в UPPER_SNAKE. */
export interface GqlProblem {
  id: string;
  title: string;
  url: string | null;
  difficulty: string;
  status: string;
  patterns: string[];
  note: string | null;
  createdAt: string;
}

const toEnum = (v: string) => v.toUpperCase().replace(/-/g, '_');
const fromEnum = (v: string) => v.toLowerCase().replace(/_/g, '-');

export function fromGqlProblem(p: GqlProblem): Problem {
  return {
    id: p.id,
    title: p.title,
    url: p.url ?? undefined,
    difficulty: fromEnum(p.difficulty) as Difficulty,
    status: fromEnum(p.status) as ProblemStatus,
    patterns: p.patterns.map(fromEnum) as Pattern[],
    note: p.note ?? undefined,
    createdAt: p.createdAt,
  };
}

interface ProblemFields {
  title: string;
  url?: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  patterns: Pattern[];
  note?: string;
}

export function toGqlInput(fields: ProblemFields) {
  return {
    title: fields.title,
    url: fields.url ?? null,
    difficulty: toEnum(fields.difficulty),
    status: toEnum(fields.status),
    patterns: fields.patterns.map(toEnum),
    note: fields.note ?? null,
  };
}

const PROBLEM_FIELDS = /* GraphQL */ `
  fragment ProblemFields on Problem {
    id
    title
    url
    difficulty
    status
    patterns
    note
    createdAt
  }
`;

export const PROBLEMS_QUERY = /* GraphQL */ `
  ${PROBLEM_FIELDS}
  query Problems($workspaceId: ID!) {
    problems(workspaceId: $workspaceId) {
      ...ProblemFields
    }
  }
`;

export const PROBLEMS_CHANGED_SUBSCRIPTION = /* GraphQL */ `
  ${PROBLEM_FIELDS}
  subscription ProblemsChanged($workspaceId: ID!) {
    problemsChanged(workspaceId: $workspaceId) {
      ...ProblemFields
    }
  }
`;

export const CREATE_PROBLEM = /* GraphQL */ `
  ${PROBLEM_FIELDS}
  mutation CreateProblem($workspaceId: ID!, $input: ProblemInput!) {
    createProblem(workspaceId: $workspaceId, input: $input) {
      ...ProblemFields
    }
  }
`;

export const UPDATE_PROBLEM = /* GraphQL */ `
  ${PROBLEM_FIELDS}
  mutation UpdateProblem($workspaceId: ID!, $id: ID!, $input: ProblemInput!) {
    updateProblem(workspaceId: $workspaceId, id: $id, input: $input) {
      ...ProblemFields
    }
  }
`;

export const CYCLE_PROBLEM_STATUS = /* GraphQL */ `
  ${PROBLEM_FIELDS}
  mutation CycleProblemStatus($workspaceId: ID!, $id: ID!) {
    cycleProblemStatus(workspaceId: $workspaceId, id: $id) {
      ...ProblemFields
    }
  }
`;

export const DELETE_PROBLEM = /* GraphQL */ `
  mutation DeleteProblem($workspaceId: ID!, $id: ID!) {
    deleteProblem(workspaceId: $workspaceId, id: $id)
  }
`;
