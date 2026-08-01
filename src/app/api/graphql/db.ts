import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Файловое хранилище мок-сервера. Заменяется настоящей БД, когда появится бэкенд —
 * резолверы обращаются только к load()/save(), так что менять придётся один модуль.
 */

export interface DbProblem {
  id: string;
  title: string;
  url?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'todo' | 'hint' | 'solved';
  patterns: string[];
  note?: string;
  createdAt: string;
}

export interface DbWorkspace {
  id: string;
  name: string;
}

interface Db {
  workspaces: DbWorkspace[];
  /** problems[workspaceId] — всё скоупится воркспейсом, как и на фронте */
  problems: Record<string, DbProblem[]>;
}

const DB_PATH = join(process.cwd(), '.data', 'db.json');

const EMPTY: Db = {
  workspaces: [{ id: 'personal', name: 'Personal' }],
  problems: {},
};

export function load(): Db {
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, 'utf8')) as Partial<Db>;
    return {
      workspaces: parsed.workspaces ?? EMPTY.workspaces,
      problems: parsed.problems ?? {},
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

/**
 * Пишет базу целиком. Запись идёт во временный файл и подменяется `rename`,
 * который на одной ФС атомарен: иначе падение посреди `writeFileSync` оставляет
 * на диске обрезанный JSON, и `load()` молча вернёт пустую базу.
 */
export function save(db: Db): void {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
}

/**
 * Единственный способ изменить данные: одно чтение, одна запись.
 * Резолверы раньше звали `load()` до трёх раз за мутацию — при появлении любого
 * await между чтением и записью это превратилось бы в потерянное обновление.
 *
 * `next === undefined` означает «ничего не изменилось»: файл не переписывается.
 */
export function mutate<T>(
  workspaceId: string,
  fn: (current: DbProblem[]) => { next?: DbProblem[]; result: T },
): { changed: boolean; result: T } {
  const db = load();
  const { next, result } = fn(problemsOf(db, workspaceId));
  if (next === undefined) return { changed: false, result };
  db.problems[workspaceId] = next;
  save(db);
  return { changed: true, result };
}

export function problemsOf(db: Db, workspaceId: string): DbProblem[] {
  return db.problems[workspaceId] ?? [];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
