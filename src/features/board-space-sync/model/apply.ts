import type { Dispatch } from 'react';
import {
  spaceDeleteContent,
  spaceReadContent,
  spaceSaveContent,
  type SpaceAction,
} from '@/entities/space';
import type { SyncOp } from './types';

/**
 * Применяет план к стору Пространства.
 *
 * Единственная сторонняя запись здесь — удаление содержимого файла: оно лежит не в состоянии,
 * а в localStorage (см. `spaceReadContent`), и вместе с узлом само не исчезнет.
 */
export function applySyncOps(
  ops: readonly SyncOp[],
  dispatch: Dispatch<SpaceAction>,
  workspaceId: string,
): void {
  for (const op of ops) {
    switch (op.type) {
      case 'create':
        dispatch({ type: 'ADD_NODE', node: op.node });
        // Содержимое живёт вне состояния, поэтому копируется здесь же, до того как файл
        // кто-нибудь откроет: пустой документ, открытый в редакторе, тут же перезаписал бы его.
        if (op.copyContentFrom) {
          spaceSaveContent(
            op.node.id,
            spaceReadContent(op.copyContentFrom, workspaceId),
            workspaceId,
          );
        }
        break;

      case 'rename':
        dispatch({ type: 'RENAME_NODE', id: op.id, name: op.name });
        break;

      case 'move':
        dispatch({ type: 'MOVE_NODE', id: op.id, parentId: op.parentId });
        break;

      case 'detach':
        dispatch({ type: 'DETACH_ORIGIN', id: op.id });
        break;

      case 'delete':
        for (const id of op.contentIds) spaceDeleteContent(id, workspaceId);
        dispatch({ type: 'DELETE_NODE', id: op.id, descendants: op.descendants });
        break;
    }
  }
}
