import { loadBoard, type BNode, type BoardMeta, type BoardNodeRef } from '@/entities/board';

/** Одна доска, показывающая файл, и нода, которая его показывает. */
export interface BoardUsage {
  boardId: string;
  boardName: string;
  nodeId: string;
  /** Доска-владелец: файл лежит в её папке, и его имя ведёт её нода. */
  owner: boolean;
}

/** Ссылается ли нода на этот адрес — или сама им является. */
function usesRef(node: BNode, boardId: string, origin: BoardNodeRef): boolean {
  if (node.link) return node.link.boardId === origin.boardId && node.link.nodeId === origin.nodeId;
  return boardId === origin.boardId && node.id === origin.nodeId;
}

/**
 * Где ещё в воркспейсе используется файл — то есть какие доски показывают ноду-оригинал.
 *
 * Обходит доски через их сохранённые документы: связи направлены от копии к оригиналу, и с
 * другой стороны узнать о них неоткуда. Обход недешёвый (чтение localStorage на каждую доску),
 * поэтому вызывается не на рендер, а на открытие панели и смену списка досок.
 *
 * Открытая доска берётся из `currentNodes`, а не с диска: её сохранение отложено на полсекунды,
 * и только что вставленная связанная копия иначе не попала бы в список.
 */
export function findFileUsage(
  workspaceId: string,
  boards: readonly BoardMeta[],
  origin: BoardNodeRef,
  current?: { boardId: string; nodes: BNode[] },
): BoardUsage[] {
  const usage: BoardUsage[] = [];

  for (const meta of boards) {
    const nodes =
      current && current.boardId === meta.id
        ? current.nodes
        : loadBoard(workspaceId, meta.id).nodes;

    const node = nodes.find((n) => usesRef(n, meta.id, origin));
    if (!node) continue;

    usage.push({
      boardId: meta.id,
      boardName: meta.name,
      nodeId: node.id,
      owner: meta.id === origin.boardId && node.id === origin.nodeId,
    });
  }

  // Владелец первым: с него начинается объяснение, откуда файл взялся.
  return usage.sort((a, b) => Number(b.owner) - Number(a.owner));
}
