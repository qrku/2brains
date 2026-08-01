import { createSchema, createYoga, createPubSub } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import { typeDefs } from '@/shared/api/schema';
import { load, mutate, problemsOf, uid, type DbProblem } from './db';
import { isSafeUrl } from '@/shared/lib/safeUrl';

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

/* Лимиты на вход: тело мутации приходит от клиента без ограничений,
 * а данные ложатся в файл на диске сервера. */
const MAX_TITLE_CHARS = 300;
const MAX_URL_CHARS = 2000;
const MAX_NOTE_CHARS = 5000;
const MAX_PATTERNS = 20;
const MAX_WORKSPACE_ID_CHARS = 64;

function badInput(message: string): never {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

function checkWorkspaceId(workspaceId: string): string {
  if (!workspaceId || workspaceId.length > MAX_WORKSPACE_ID_CHARS) {
    badInput(`workspaceId must be 1..${MAX_WORKSPACE_ID_CHARS} characters`);
  }
  return workspaceId;
}

function inProblem(input: ProblemInput) {
  const title = input.title?.trim() ?? '';
  if (!title) badInput('title must not be empty');
  if (title.length > MAX_TITLE_CHARS) badInput(`title must be at most ${MAX_TITLE_CHARS} characters`);
  if (input.url) {
    if (input.url.length > MAX_URL_CHARS) badInput(`url must be at most ${MAX_URL_CHARS} characters`);
    // Ссылка потом рендерится как <a href>; схему проверяем на входе, а не только при выводе.
    if (!isSafeUrl(input.url)) badInput('url scheme is not allowed');
  }
  if (input.note && input.note.length > MAX_NOTE_CHARS) {
    badInput(`note must be at most ${MAX_NOTE_CHARS} characters`);
  }
  if (input.patterns.length > MAX_PATTERNS) badInput(`no more than ${MAX_PATTERNS} patterns`);

  return {
    title,
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

/**
 * Читает задачи воркспейса, применяет `fn` и записывает результат одним заходом,
 * после чего уведомляет подписчиков. Публикация только при реальном изменении.
 */
function commitProblems<T>(
  workspaceId: string,
  fn: (current: DbProblem[]) => { next?: DbProblem[]; result: T },
): T {
  const { changed, result } = mutate(checkWorkspaceId(workspaceId), fn);
  if (changed) pubsub.publish(topic(workspaceId), workspaceId);
  return result;
}

function findProblem(problems: DbProblem[], id: string): DbProblem {
  const problem = problems.find((p) => p.id === id);
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
        problemsOf(load(), checkWorkspaceId(workspaceId)).map(outProblem),
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
        return commitProblems(workspaceId, (current) => ({
          next: [problem, ...current],
          result: outProblem(problem),
        }));
      },

      updateProblem: (
        _: unknown,
        { workspaceId, id, input }: { workspaceId: string; id: string; input: ProblemInput },
      ) =>
        commitProblems(workspaceId, (current) => {
          findProblem(current, id); // 404, если задачи нет
          const patch = inProblem(input);
          const next = current.map((p) => (p.id === id ? { ...p, ...patch } : p));
          return { next, result: outProblem(next.find((p) => p.id === id)!) };
        }),

      cycleProblemStatus: (_: unknown, { workspaceId, id }: { workspaceId: string; id: string }) =>
        commitProblems(workspaceId, (current) => {
          const problem = findProblem(current, id);
          const status = STATUS_CYCLE[problem.status];
          return {
            next: current.map((p) => (p.id === id ? { ...p, status } : p)),
            result: outProblem({ ...problem, status }),
          };
        }),

      deleteProblem: (_: unknown, { workspaceId, id }: { workspaceId: string; id: string }) =>
        commitProblems(workspaceId, (current) => {
          const next = current.filter((p) => p.id !== id);
          // Ничего не удалили — не переписываем файл и не будим подписчиков.
          if (next.length === current.length) return { result: false };
          return { next, result: true };
        }),
    },

    Subscription: {
      problemsChanged: {
        subscribe: (_: unknown, { workspaceId }: { workspaceId: string }) =>
          pubsub.subscribe(topic(checkWorkspaceId(workspaceId))),
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
  // GraphiQL и интроспекция — только в dev: в проде это карта всего API наружу.
  graphiql: process.env.NODE_ENV !== 'production',
  // Next сам владеет Request/Response — отдаём ему нативные объекты Fetch API.
  fetchAPI: { Response },
});

// Хендлер yoga нельзя реэкспортировать напрямую: его второй параметр (контекст адаптера)
// не совпадает с тем, что Next передаёт роуту, и сборка падает на валидации типов роутов.
const handle = (request: Request) => handleRequest(request, {});

export { handle as GET, handle as POST, handle as OPTIONS };
