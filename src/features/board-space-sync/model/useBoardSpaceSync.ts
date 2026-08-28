'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { BNode } from '@/entities/board';
import { useSpaceStore } from '@/entities/space';
import { useWorkspaceStore } from '@/entities/workspace';
import { uid } from '@/shared/lib/uid';
import { applySyncOps } from './apply';
import { planBoardMirror } from './plan';

/**
 * Пауза после последней правки доски перед пересчётом дерева. Подпись ноды набирается по
 * символу, а каждый символ — это потенциальное переименование файла; без паузы дерево
 * дёргалось бы на каждой букве.
 */
const SYNC_DEBOUNCE_MS = 400;

export interface BoardMirrorTarget {
  /** `null`, пока список досок не загрузился. */
  boardId: string | null;
  name: string;
  nodes: BNode[];
  /**
   * Доска загружена. До этого её `nodes` — пустой массив начального состояния, и
   * синхронизация приняла бы его за «пользователь удалил всё» и снесла бы файлы.
   */
  ready: boolean;
}

const nowIso = () => new Date().toISOString();

/**
 * Держит дерево Пространства согласованным с открытой доской.
 *
 * Пересчёт идёт и на правку доски, и на правку дерева: правки в дереве, которые ведёт доска
 * (имя файла ноды, его папка), возвращаются к тому, что показывает доска — источник правды
 * один. План идемпотентен, поэтому цикл «применили → состояние изменилось → пересчитали»
 * сходится на первом же холостом проходе.
 */
export function useBoardSpaceSync({ boardId, name, nodes, ready }: BoardMirrorTarget): void {
  const { state: spaceState, dispatch } = useSpaceStore();
  const { state: wsState } = useWorkspaceStore();

  // Дерево на момент срабатывания таймера, а не на момент постановки эффекта.
  const spaceNodesRef = useRef(spaceState.nodes);
  spaceNodesRef.current = spaceState.nodes;

  const hydrated = spaceState.hydrated;
  const spaceNodes = spaceState.nodes;
  const workspaceId = wsState.currentId;

  useEffect(() => {
    if (!ready || !boardId || !hydrated) return;

    // Таймер сбрасывается на любое изменение зависимостей, поэтому смена доски или
    // воркспейса гарантированно не успевает сработать на переходном состоянии.
    const timer = setTimeout(() => {
      const ops = planBoardMirror({
        boardId,
        board: { name, nodes },
        spaceNodes: spaceNodesRef.current,
        newId: uid,
        now: nowIso,
      });
      if (ops.length) applySyncOps(ops, dispatch, workspaceId);
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [ready, boardId, name, nodes, hydrated, spaceNodes, dispatch, workspaceId]);
}

/**
 * Убирает отражение доски целиком — для случая, когда саму доску удалили.
 *
 * Живёт отдельно от `useBoardSpaceSync`: та синхронизирует только открытую доску, а удаляют
 * из списка любую, в том числе не открытую.
 */
export function useRemoveBoardMirror(): (boardId: string) => void {
  const { state: spaceState, dispatch } = useSpaceStore();
  const { state: wsState } = useWorkspaceStore();

  const spaceNodesRef = useRef(spaceState.nodes);
  spaceNodesRef.current = spaceState.nodes;
  const workspaceId = wsState.currentId;

  return useCallback(
    (boardId: string) => {
      const ops = planBoardMirror({
        boardId,
        board: null,
        spaceNodes: spaceNodesRef.current,
        newId: uid,
        now: nowIso,
      });
      if (ops.length) applySyncOps(ops, dispatch, workspaceId);
    },
    [dispatch, workspaceId],
  );
}
