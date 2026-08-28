import type { BNode } from '@/entities/board';
import type { SpaceNode } from '@/entities/space';

/** Доска в том виде, в каком её отражает Пространство. */
export interface MirrorBoard {
  name: string;
  nodes: BNode[];
}

/**
 * Одно изменение дерева Пространства, приводящее его в соответствие с доской.
 *
 * План считается целиком и только потом применяется — так шаг «посчитать» остаётся чистой
 * функцией, которую можно проверить тестом без React, стора и localStorage.
 */
export type SyncOp =
  | {
      type: 'create';
      node: SpaceNode;
      /**
       * Файл, содержимое которого нужно перенести в новый. Ставится для нод, вставленных
       * дубликатом с другой доски: дубликат — это копия вместе с текстом, а не пустой файл
       * с тем же названием.
       */
      copyContentFrom?: string;
    }
  | { type: 'rename'; id: string; name: string }
  | { type: 'move'; id: string; parentId: string | null }
  /** Узел перестаёт быть зеркалом: доски или фрейма уже нет, но внутри лежит ручной контент. */
  | { type: 'detach'; id: string }
  | { type: 'delete'; id: string; descendants: string[]; contentIds: string[] };

export interface PlanBoardMirrorInput {
  boardId: string;
  /** `null` — доски больше нет, её отражение нужно убрать. */
  board: MirrorBoard | null;
  spaceNodes: SpaceNode[];
  /** Генератор id — параметром, чтобы план был воспроизводим в тестах. */
  newId: () => string;
  /** Текущее время в ISO — по той же причине. */
  now: () => string;
}
