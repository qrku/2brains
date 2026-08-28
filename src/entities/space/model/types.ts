/**
 * Откуда узел взялся в дереве, если его создал не пользователь, а зеркало Доски.
 *
 * Узлы без `origin` — обычные, приложение их не трогает. Узлы с `origin` принадлежат доске:
 * их имя и расположение ведёт синхронизация, а дерево показывает их иначе (см. FileTree).
 * Обратной ссылки на доске нет намеренно — источник правды один, доска, а Пространство её
 * отражает; так восстановление доски из старого сохранения не может разойтись с деревом.
 */
export type SpaceNodeOrigin =
  | { kind: 'board'; boardId: string }
  | { kind: 'frame'; boardId: string; frameId: string }
  | { kind: 'node'; boardId: string; nodeId: string };

export interface SpaceNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  createdAt: string;
  origin?: SpaceNodeOrigin;
}

export interface SpaceState {
  hydrated: boolean;
  nodes: SpaceNode[];
  openFileId: string | null;
  expanded: string[];
}

export type SpaceAction =
  | { type: 'HYDRATE'; nodes: SpaceNode[]; expanded: string[]; openFileId: string | null }
  | { type: 'ADD_NODE'; node: SpaceNode }
  | { type: 'MOVE_NODE'; id: string; parentId: string | null }
  | { type: 'DELETE_NODE'; id: string; descendants: string[] }
  | { type: 'RENAME_NODE'; id: string; name: string }
  | { type: 'DETACH_ORIGIN'; id: string }
  | { type: 'OPEN_FILE'; id: string }
  | { type: 'TOGGLE_FOLDER'; id: string };
