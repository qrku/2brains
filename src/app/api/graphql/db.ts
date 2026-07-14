import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

export function save(db: Db): void {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function problemsOf(db: Db, workspaceId: string): DbProblem[] {
  return db.problems[workspaceId] ?? [];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
