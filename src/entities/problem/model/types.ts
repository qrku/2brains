export type Difficulty = 'easy' | 'medium' | 'hard';
export type ProblemStatus = 'todo' | 'hint' | 'solved';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
};

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  todo:   'Не решал',
  hint:   'С подсказкой',
  solved: 'Решил сам',
};

export const STATUS_CYCLE: Record<ProblemStatus, ProblemStatus> = {
  todo:   'hint',
  hint:   'solved',
  solved: 'todo',
};

export const PATTERNS = [
  { value: 'array',          label: 'Массивы' },
  { value: 'hash-map',       label: 'Хеш-таблица' },
  { value: 'two-pointers',   label: 'Два указателя' },
  { value: 'sliding-window', label: 'Скользящее окно' },
  { value: 'binary-search',  label: 'Бинарный поиск' },
  { value: 'stack',          label: 'Стек' },
  { value: 'queue',          label: 'Очередь' },
  { value: 'linked-list',    label: 'Связный список' },
  { value: 'tree',           label: 'Деревья' },
  { value: 'bfs',            label: 'BFS' },
  { value: 'dfs',            label: 'DFS' },
  { value: 'graph',          label: 'Графы' },
  { value: 'backtracking',   label: 'Backtracking' },
  { value: 'dp',             label: 'Динамика' },
  { value: 'greedy',         label: 'Жадный' },
  { value: 'heap',           label: 'Куча' },
  { value: 'sorting',        label: 'Сортировка' },
  { value: 'bit-ops',        label: 'Биты' },
  { value: 'trie',           label: 'Trie' },
  { value: 'math',           label: 'Математика' },
] as const;

export type Pattern = typeof PATTERNS[number]['value'];

export const PATTERN_MAP = Object.fromEntries(
  PATTERNS.map(({ value, label }) => [value, label])
) as Record<Pattern, string>;

export interface Problem {
  id: string;
  title: string;
  url?: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  patterns: Pattern[];
  note?: string;
  createdAt: string;
}
