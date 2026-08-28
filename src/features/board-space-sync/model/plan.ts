import { frameOf } from '@/entities/board';
import type { SpaceNode } from '@/entities/space';
import { fileNameFor, folderNameFor, uniqueName } from './naming';
import { ownsFile, ownsFolder } from './policy';
import type { PlanBoardMirrorInput, SyncOp } from './types';

/**
 * Разница между доской и её отражением в дереве Пространства.
 *
 * Структура зеркала: папка с именем доски в корне, внутри — по подпапке на каждый фрейм,
 * а файлы нод лежат либо в папке фрейма, если нода внутри него, либо прямо в папке доски.
 * Принадлежность фрейму чисто геометрическая (`frameOf`), поэтому перетаскивание ноды в
 * фрейм и обратно перекладывает её файл между папками само собой.
 *
 * Источник правды — доска: план приводит дерево к ней, а не наоборот. Функция чистая и
 * идемпотентная — на согласованном состоянии возвращает пустой список.
 */
export function planBoardMirror({
  boardId,
  board,
  spaceNodes,
  newId,
  now,
}: PlanBoardMirrorInput): SyncOp[] {
  const ops: SyncOp[] = [];

  /* ── Что уже есть в дереве от этой доски ──────────────────────────── */
  const boardFolder = spaceNodes.find(
    (n) => n.origin?.kind === 'board' && n.origin.boardId === boardId,
  );
  const frameFolders = new Map<string, SpaceNode>();
  const nodeFiles = new Map<string, SpaceNode>();
  for (const n of spaceNodes) {
    if (n.origin?.boardId !== boardId) continue;
    if (n.origin.kind === 'frame') frameFolders.set(n.origin.frameId, n);
    else if (n.origin.kind === 'node') nodeFiles.set(n.origin.nodeId, n);
  }

  /* ── Что должно быть ──────────────────────────────────────────────── */
  // Связанные копии пропускаются: они показывают файл и папку оригинала, своих не заводят.
  const frames = board ? board.nodes.filter(ownsFolder) : [];
  const mirroredNodes = board ? board.nodes.filter(ownsFile) : [];
  // Пустая доска не заводит папку: иначе каждое открытие новой доски засоряло бы корень.
  const hasContent = frames.length > 0 || mirroredNodes.length > 0;

  /**
   * Имена, уже занятые в папке чужими узлами — ручными и зеркалами других досок.
   * Свои файлы исключены: они получают имена здесь же и попадают в набор по мере назначения.
   */
  const takenNames = (parentId: string | null, type: SpaceNode['type']): Set<string> => {
    const taken = new Set<string>();
    for (const n of spaceNodes) {
      if (n.parentId !== parentId || n.type !== type) continue;
      if (n.origin?.boardId === boardId) continue;
      taken.add(n.name);
    }
    return taken;
  };

  /* ── Папка доски ──────────────────────────────────────────────────── */
  let boardFolderId: string | null = null;
  if (board && hasContent) {
    const name = folderNameFor(board.name);
    if (boardFolder) {
      boardFolderId = boardFolder.id;
      if (boardFolder.name !== name) ops.push({ type: 'rename', id: boardFolder.id, name });
      // Родитель намеренно не навязывается: папку доски пользователь волен убрать в любое
      // место дерева, это его организация. Внутренняя структура папки — уже наша.
    } else {
      boardFolderId = newId();
      ops.push({
        type: 'create',
        node: {
          id: boardFolderId,
          name: uniqueName(name, takenNames(null, 'folder')),
          type: 'folder',
          parentId: null,
          createdAt: now(),
          origin: { kind: 'board', boardId },
        },
      });
    }
  }

  /* ── Папки фреймов ────────────────────────────────────────────────── */
  const frameFolderIds = new Map<string, string>();
  if (board && boardFolderId) {
    const taken = takenNames(boardFolderId, 'folder');
    for (const frame of frames) {
      const name = uniqueName(folderNameFor(frame.text), taken);
      taken.add(name);

      const existing = frameFolders.get(frame.id);
      if (existing) {
        frameFolderIds.set(frame.id, existing.id);
        if (existing.name !== name) ops.push({ type: 'rename', id: existing.id, name });
        if (existing.parentId !== boardFolderId) {
          ops.push({ type: 'move', id: existing.id, parentId: boardFolderId });
        }
      } else {
        const id = newId();
        frameFolderIds.set(frame.id, id);
        ops.push({
          type: 'create',
          node: {
            id,
            name,
            type: 'folder',
            parentId: boardFolderId,
            createdAt: now(),
            origin: { kind: 'frame', boardId, frameId: frame.id },
          },
        });
      }
    }
  }

  /* ── Файлы нод ────────────────────────────────────────────────────── */
  if (board && boardFolderId) {
    const takenPerFolder = new Map<string, Set<string>>();
    const takenIn = (parentId: string): Set<string> => {
      let taken = takenPerFolder.get(parentId);
      if (!taken) {
        taken = takenNames(parentId, 'file');
        takenPerFolder.set(parentId, taken);
      }
      return taken;
    };

    for (const node of mirroredNodes) {
      const frame = frameOf(board.nodes, node);
      const parentId = (frame && frameFolderIds.get(frame.id)) || boardFolderId;

      const taken = takenIn(parentId);
      const name = uniqueName(fileNameFor(node.text), taken);
      taken.add(name);

      const existing = nodeFiles.get(node.id);
      if (existing) {
        if (existing.name !== name) ops.push({ type: 'rename', id: existing.id, name });
        if (existing.parentId !== parentId) ops.push({ type: 'move', id: existing.id, parentId });
      } else {
        // Ноду вставили дубликатом — новый файл начинается с текста оригинала. Если оригинала
        // уже нет, дубликат просто заводится пустым: терять тут нечего.
        const source = node.copiedFrom
          ? spaceNodes.find(
              (n) =>
                n.origin?.kind === 'node' &&
                n.origin.boardId === node.copiedFrom!.boardId &&
                n.origin.nodeId === node.copiedFrom!.nodeId,
            )
          : undefined;

        ops.push({
          type: 'create',
          node: {
            id: newId(),
            name,
            type: 'file',
            parentId,
            createdAt: now(),
            origin: { kind: 'node', boardId, nodeId: node.id },
          },
          ...(source ? { copyContentFrom: source.id } : {}),
        });
      }
    }
  }

  /* ── Того, чего на доске больше нет ───────────────────────────────── */

  /** Останется ли внутри папки хоть что-то после всех уже запланированных операций. */
  const hasSurvivors = (folderId: string): boolean => {
    const deleted = new Set<string>();
    const moved = new Map<string, string | null>();
    const created: SpaceNode[] = [];
    for (const op of ops) {
      if (op.type === 'delete') {
        deleted.add(op.id);
        for (const d of op.descendants) deleted.add(d);
      } else if (op.type === 'move') moved.set(op.id, op.parentId);
      else if (op.type === 'create') created.push(op.node);
    }

    return [...spaceNodes, ...created].some((n) => {
      if (n.id === folderId || deleted.has(n.id)) return false;
      return (moved.has(n.id) ? moved.get(n.id) : n.parentId) === folderId;
    });
  };

  /**
   * Папка мёртвого фрейма или доски: удаляется, только если опустела. Если внутри остался
   * контент, созданный руками, он важнее аккуратности зеркала — папка просто перестаёт быть
   * зеркалом и живёт дальше обычной папкой.
   */
  const removeOrDetach = (folder: SpaceNode): SyncOp =>
    hasSurvivors(folder.id)
      ? { type: 'detach', id: folder.id }
      : { type: 'delete', id: folder.id, descendants: [], contentIds: [] };

  // Файлы — раньше папок: иначе папка фрейма никогда не окажется пустой.
  const liveNodeIds = new Set(mirroredNodes.map((n) => n.id));
  for (const [nodeId, file] of nodeFiles) {
    if (liveNodeIds.has(nodeId)) continue;
    ops.push({ type: 'delete', id: file.id, descendants: [], contentIds: [file.id] });
  }

  const liveFrameIds = new Set(frames.map((f) => f.id));
  for (const [frameId, folder] of frameFolders) {
    if (liveFrameIds.has(frameId)) continue;
    ops.push(removeOrDetach(folder));
  }

  if (boardFolder && !(board && hasContent)) ops.push(removeOrDetach(boardFolder));

  return ops;
}
