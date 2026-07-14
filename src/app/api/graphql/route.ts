import { createSchema, createYoga, createPubSub } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import { typeDefs } from '@/shared/api/schema';
import { load, save, problemsOf, uid, type DbProblem } from './db';

/* ─── Маппинг enum'ов ───────────────────────────────────────────────────────
 * В схеме — UPPER_SNAKE (конвенция GraphQL), в данных фронта — kebab-case.
 * Держим данные в формате фронта и конвертируем на границе API. */
const toEnum   = (v: string) => v.toUpperCase().replace(/-/g, '_');
const fromEnum = (v: string) => v.toLowerCase().replace(/_/g, '-');

function outProblem(p: DbProblem) {
  return {
    ...p,
    difficulty: toEnum(p.difficulty),
    status: toEnum(p.status),
    patterns: p.patterns.map(toEnum),
  };
}

interface ProblemInput {
  title: string;
  url?: string;
  difficulty: string;
  status: string;
  patterns: string[];
  note?: string;
}

function inProblem(input: ProblemInput) {
  return {
    title: input.title,
    url: input.url ?? undefined,
    difficulty: fromEnum(input.difficulty) as DbProblem['difficulty'],
    status: fromEnum(input.status) as DbProblem['status'],
    patterns: input.patterns.map(fromEnum),
    note: input.note ?? undefined,
  };
}

const STATUS_CYCLE: Record<DbProblem['status'], DbProblem['status']> = {
  todo: 'hint',
  hint: 'solved',
  solved: 'todo',
};

/* ─── PubSub ────────────────────────────────────────────────────────────────
 * Держим на globalThis: Next в dev пересоздаёт модуль при hot-reload, а вместе
 * с ним и pubsub — открытые подписки при этом теряют издателя.
 * В проде с несколькими инстансами это должен быть Redis, а не память. */
const g = globalThis as typeof globalThis & {
  __pubsub?: ReturnType<typeof createPubSub<Record<string, [string]>>>;
};
const pubsub = (g.__pubsub ??= createPubSub<Record<string, [string]>>());

/** Топик на воркспейс: подписчик не получает событий о чужих данных. */
const topic = (workspaceId: string) => `problems:${workspaceId}`;

/** Записывает задачи воркспейса и уведомляет подписчиков. */
function commitProblems(workspaceId: string, next: DbProblem[]) {
  const db = load();
  db.problems[workspaceId] = next;
  save(db);
  pubsub.publish(topic(workspaceId), workspaceId);
}

function findProblem(workspaceId: string, id: string): DbProblem {
  const problem = problemsOf(load(), workspaceId).find((p) => p.id === id);
  // GraphQLError, а не Error: иначе yoga считает это внутренним сбоем и отдаёт клиенту
  // INTERNAL_SERVER_ERROR со стектрейсом вместо внятного кода.
  if (!problem) {
    throw new GraphQLError(`Problem ${id} not found`, {
      extensions: { code: 'NOT_FOUND' },
    });
  }
  return problem;
}

const schema = createSchema({
  typeDefs,
  resolvers: {
    Query: {
      workspaces: () => load().workspaces,
      problems: (_: unknown, { workspaceId }: { workspaceId: string }) =>
        problemsOf(load(), workspaceId).map(outProblem),
    },

    Mutation: {
      createProblem: (
        _: unknown,
        { workspaceId, input }: { workspaceId: string; input: ProblemInput },
      ) => {
        const problem: DbProblem = {
          id: uid(),
          ...inProblem(input),
          createdAt: new Date().toISOString(),
        };
        commitProblems(workspaceId, [problem, ...problemsOf(load(), workspaceId)]);
        return outProblem(problem);
      },

      updateProblem: (
        _: unknown,
        { workspaceId, id, input }: { workspaceId: string; id: string; input: ProblemInput },
      ) => {
        findProblem(workspaceId, id); // 404, если задачи нет
        const next = problemsOf(load(), workspaceId).map((p) =>
          p.id === id ? { ...p, ...inProblem(input) } : p,
        );
        commitProblems(workspaceId, next);
        return outProblem(next.find((p) => p.id === id)!);
      },

      cycleProblemStatus: (
        _: unknown,
        { workspaceId, id }: { workspaceId: string; id: string },
      ) => {
        const current = findProblem(workspaceId, id);
        const status = STATUS_CYCLE[current.status];
        const next = problemsOf(load(), workspaceId).map((p) =>
          p.id === id ? { ...p, status } : p,
        );
        commitProblems(workspaceId, next);
        return outProblem({ ...current, status });
      },

      deleteProblem: (_: unknown, { workspaceId, id }: { workspaceId: string; id: string }) => {
        const before = problemsOf(load(), workspaceId);
        const next = before.filter((p) => p.id !== id);
        if (next.length === before.length) return false;
        commitProblems(workspaceId, next);
        return true;
      },
    },

    Subscription: {
      problemsChanged: {
        subscribe: (_: unknown, { workspaceId }: { workspaceId: string }) =>
          pubsub.subscribe(topic(workspaceId)),
        // pubsub отдаёт только id воркспейса — полезная нагрузка читается здесь,
        // чтобы каждый подписчик получил актуальный список.
        resolve: (changedIn: string) =>
          problemsOf(load(), changedIn).map(outProblem),
      },
    },
  },
});

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  // Next сам владеет Request/Response — отдаём ему нативные объекты Fetch API.
  fetchAPI: { Response },
});

// Хендлер yoga нельзя реэкспортировать напрямую: его второй параметр (контекст адаптера)
// не совпадает с тем, что Next передаёт роуту, и сборка падает на валидации типов роутов.
const handle = (request: Request) => handleRequest(request, {});

export { handle as GET, handle as POST, handle as OPTIONS };
