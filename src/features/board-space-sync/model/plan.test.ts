import type { BNode, NodeKind } from '@/entities/board';
import type { SpaceNode } from '@/entities/space';
import { planBoardMirror } from './plan';
import type { MirrorBoard, SyncOp } from './types';

const BOARD_ID = 'b1';

let idCounter = 0;
const newId = () => `new${++idCounter}`;
const now = () => '2026-01-01T00:00:00.000Z';

beforeEach(() => {
  idCounter = 0;
});

function node(
  id: string,
  text: string,
  kind: NodeKind = 'box',
  box: Partial<Pick<BNode, 'x' | 'y' | 'w' | 'h'>> = {},
): BNode {
  return {
    id,
    text,
    kind,
    x: box.x ?? 0,
    y: box.y ?? 0,
    w: box.w ?? 100,
    h: box.h ?? 50,
    fontSize: 13,
    shape: 'rect',
  };
}

const plan = (board: MirrorBoard | null, spaceNodes: SpaceNode[] = []) =>
  planBoardMirror({ boardId: BOARD_ID, board, spaceNodes, newId, now });

/** Применяет план к дереву — нужно, чтобы проверить идемпотентность второго прохода. */
function applyToTree(nodes: SpaceNode[], ops: SyncOp[]): SpaceNode[] {
  let out = [...nodes];
  for (const op of ops) {
    switch (op.type) {
      case 'create':
        out.push(op.node);
        break;
      case 'rename':
        out = out.map((n) => (n.id === op.id ? { ...n, name: op.name } : n));
        break;
      case 'move':
        out = out.map((n) => (n.id === op.id ? { ...n, parentId: op.parentId } : n));
        break;
      case 'detach':
        out = out.map((n) => (n.id === op.id ? { ...n, origin: undefined } : n));
        break;
      case 'delete': {
        const gone = new Set([op.id, ...op.descendants]);
        out = out.filter((n) => !gone.has(n.id));
        break;
      }
    }
  }
  return out;
}

/** Полный проход: план + применение — как это делает `useBoardSpaceSync`. */
function sync(board: MirrorBoard | null, spaceNodes: SpaceNode[] = []): SpaceNode[] {
  return applyToTree(spaceNodes, plan(board, spaceNodes));
}

const findByName = (nodes: SpaceNode[], name: string) => nodes.find((n) => n.name === name);

describe('planBoardMirror', () => {
  it('пустая доска не заводит папку', () => {
    expect(plan({ name: 'Доска 1', nodes: [] })).toEqual([]);
  });

  it('создаёт папку доски и файл для box-ноды', () => {
    const tree = sync({ name: 'Архитектура', nodes: [node('n1', 'Кэширование')] });

    const folder = findByName(tree, 'Архитектура');
    expect(folder).toMatchObject({ type: 'folder', parentId: null });
    expect(folder!.origin).toEqual({ kind: 'board', boardId: BOARD_ID });

    const file = findByName(tree, 'Кэширование.md');
    expect(file).toMatchObject({ type: 'file', parentId: folder!.id });
    expect(file!.origin).toEqual({ kind: 'node', boardId: BOARD_ID, nodeId: 'n1' });
  });

  it('второй проход по согласованному дереву ничего не меняет', () => {
    const board = { name: 'Архитектура', nodes: [node('n1', 'Кэширование')] };
    const tree = sync(board);

    expect(plan(board, tree)).toEqual([]);
  });

  it('файл заводится только блокам: текст, рисунок и фрейм его не получают', () => {
    const tree = sync({
      name: 'Доска',
      nodes: [
        node('n1', 'Блок', 'box'),
        node('n2', 'Подпись', 'text'),
        node('n3', '', 'draw'),
        node('f1', 'Фрейм', 'frame', { w: 400, h: 400 }),
      ],
    });

    expect(tree.filter((n) => n.type === 'file').map((n) => n.name)).toEqual(['Блок.md']);
  });

  it('фрейм становится подпапкой, а нода внутри него — файлом в этой подпапке', () => {
    const frame = node('f1', 'Хранилище', 'frame', { x: 0, y: 0, w: 400, h: 400 });
    const inside = node('n1', 'Индексы', 'box', { x: 100, y: 100 });
    const outside = node('n2', 'Очередь', 'box', { x: 900, y: 900 });

    const tree = sync({ name: 'Архитектура', nodes: [frame, inside, outside] });

    const boardFolder = findByName(tree, 'Архитектура')!;
    const frameFolder = findByName(tree, 'Хранилище')!;
    expect(frameFolder).toMatchObject({ type: 'folder', parentId: boardFolder.id });
    expect(frameFolder.origin).toEqual({ kind: 'frame', boardId: BOARD_ID, frameId: 'f1' });

    expect(findByName(tree, 'Индексы.md')!.parentId).toBe(frameFolder.id);
    expect(findByName(tree, 'Очередь.md')!.parentId).toBe(boardFolder.id);
  });

  it('нода, вынесенная из фрейма, переезжает в папку доски', () => {
    const frame = node('f1', 'Хранилище', 'frame', { x: 0, y: 0, w: 400, h: 400 });
    const before = sync({
      name: 'Архитектура',
      nodes: [frame, node('n1', 'Индексы', 'box', { x: 100, y: 100 })],
    });

    const after = sync(
      { name: 'Архитектура', nodes: [frame, node('n1', 'Индексы', 'box', { x: 900, y: 900 })] },
      before,
    );

    expect(findByName(after, 'Индексы.md')!.parentId).toBe(findByName(after, 'Архитектура')!.id);
  });

  it('вложенные фреймы: нода попадает в наименьший из содержащих её', () => {
    const outer = node('f1', 'Внешний', 'frame', { x: 0, y: 0, w: 1000, h: 1000 });
    const inner = node('f2', 'Внутренний', 'frame', { x: 100, y: 100, w: 300, h: 300 });
    const inside = node('n1', 'Нода', 'box', { x: 150, y: 150 });

    const tree = sync({ name: 'Доска', nodes: [outer, inner, inside] });

    expect(findByName(tree, 'Нода.md')!.parentId).toBe(findByName(tree, 'Внутренний')!.id);
  });

  it('переименование доски и ноды переименовывает папку и файл', () => {
    const before = sync({ name: 'Архитектура', nodes: [node('n1', 'Кэширование')] });
    const after = sync({ name: 'Бэкенд', nodes: [node('n1', 'Кэш')] }, before);

    expect(findByName(after, 'Бэкенд')).toBeDefined();
    expect(findByName(after, 'Кэш.md')).toBeDefined();
    // Узлы те же самые, а не пересозданные: содержимое файла привязано к его id.
    expect(after.map((n) => n.id).sort()).toEqual(before.map((n) => n.id).sort());
  });

  it('удаление ноды удаляет её файл вместе с содержимым', () => {
    const before = sync({ name: 'Доска', nodes: [node('n1', 'Раз'), node('n2', 'Два')] });
    const fileId = findByName(before, 'Раз.md')!.id;

    const ops = plan({ name: 'Доска', nodes: [node('n2', 'Два')] }, before);

    expect(ops).toContainEqual({
      type: 'delete',
      id: fileId,
      descendants: [],
      contentIds: [fileId],
    });
  });

  it('удаление последней ноды убирает и папку доски', () => {
    const before = sync({ name: 'Доска', nodes: [node('n1', 'Раз')] });
    const after = sync({ name: 'Доска', nodes: [] }, before);

    expect(after).toEqual([]);
  });

  it('опустевшая папка удалённого фрейма удаляется', () => {
    const frame = node('f1', 'Фрейм', 'frame', { x: 0, y: 0, w: 400, h: 400 });
    const before = sync({
      name: 'Доска',
      nodes: [frame, node('n1', 'Нода', 'box', { x: 10, y: 10 })],
    });

    const after = sync(
      { name: 'Доска', nodes: [node('n1', 'Нода', 'box', { x: 10, y: 10 })] },
      before,
    );

    expect(findByName(after, 'Фрейм')).toBeUndefined();
    expect(findByName(after, 'Нода.md')!.parentId).toBe(findByName(after, 'Доска')!.id);
  });

  it('папка удалённого фрейма с ручным файлом внутри не удаляется, а отвязывается', () => {
    const frame = node('f1', 'Фрейм', 'frame', { x: 0, y: 0, w: 400, h: 400 });
    const before = sync({
      name: 'Доска',
      nodes: [frame, node('n1', 'Нода', 'box', { x: 500, y: 500 })],
    });
    const frameFolder = findByName(before, 'Фрейм')!;
    const manual: SpaceNode = {
      id: 'manual',
      name: 'моё.md',
      type: 'file',
      parentId: frameFolder.id,
      createdAt: now(),
    };

    const after = sync({ name: 'Доска', nodes: [node('n1', 'Нода', 'box', { x: 500, y: 500 })] }, [
      ...before,
      manual,
    ]);

    const kept = after.find((n) => n.id === frameFolder.id);
    expect(kept).toBeDefined();
    expect(kept!.origin).toBeUndefined();
    expect(after.find((n) => n.id === 'manual')).toBeDefined();
  });

  it('одинаковые подписи разводятся суффиксом', () => {
    const tree = sync({
      name: 'Доска',
      nodes: [node('n1', 'Идея'), node('n2', 'Идея'), node('n3', 'Идея')],
    });

    expect(
      tree
        .filter((n) => n.type === 'file')
        .map((n) => n.name)
        .sort(),
    ).toEqual(['Идея 2.md', 'Идея 3.md', 'Идея.md']);
  });

  it('имя не конфликтует с уже существующим ручным файлом', () => {
    const boardFolder: SpaceNode = {
      id: 'bf',
      name: 'Доска',
      type: 'folder',
      parentId: null,
      createdAt: now(),
      origin: { kind: 'board', boardId: BOARD_ID },
    };
    const manual: SpaceNode = {
      id: 'manual',
      name: 'Идея.md',
      type: 'file',
      parentId: 'bf',
      createdAt: now(),
    };

    const tree = sync({ name: 'Доска', nodes: [node('n1', 'Идея')] }, [boardFolder, manual]);

    expect(tree.find((n) => n.origin?.kind === 'node')!.name).toBe('Идея 2.md');
  });

  it('удаление доски убирает всё её отражение', () => {
    const frame = node('f1', 'Фрейм', 'frame', { x: 0, y: 0, w: 400, h: 400 });
    const before = sync({
      name: 'Доска',
      nodes: [frame, node('n1', 'Нода', 'box', { x: 10, y: 10 })],
    });

    expect(sync(null, before)).toEqual([]);
  });

  it('чужие доски и ручные узлы не трогаются', () => {
    const foreign: SpaceNode = {
      id: 'other',
      name: 'Другая доска',
      type: 'folder',
      parentId: null,
      createdAt: now(),
      origin: { kind: 'board', boardId: 'b2' },
    };
    const manual: SpaceNode = {
      id: 'manual',
      name: 'Заметки',
      type: 'folder',
      parentId: null,
      createdAt: now(),
    };

    expect(plan(null, [foreign, manual])).toEqual([]);
  });

  it('нода без подписи получает запасное имя', () => {
    const tree = sync({ name: 'Доска', nodes: [node('n1', '   ')] });

    expect(findByName(tree, 'Без названия.md')).toBeDefined();
  });
});

describe('planBoardMirror — связанные копии и дубликаты', () => {
  it('связанная нода не заводит своего файла', () => {
    const tree = sync({
      name: 'Доска',
      nodes: [
        node('n1', 'Своя'),
        { ...node('n2', 'Связанная'), link: { boardId: 'b2', nodeId: 'x1' } },
      ],
    });

    expect(tree.filter((n) => n.type === 'file').map((n) => n.name)).toEqual(['Своя.md']);
  });

  it('связанный фрейм не заводит своей папки', () => {
    const tree = sync({
      name: 'Доска',
      nodes: [
        node('n1', 'Своя'),
        {
          ...node('f1', 'Связанный фрейм', 'frame', { w: 400, h: 400 }),
          link: { boardId: 'b2', nodeId: 'x9' },
        },
      ],
    });

    expect(tree.find((n) => n.name === 'Связанный фрейм')).toBeUndefined();
  });

  it('нода внутри связанного фрейма кладётся в папку своей доски, а не чужого фрейма', () => {
    const tree = sync({
      name: 'Доска',
      nodes: [
        {
          ...node('f1', 'Связанный', 'frame', { x: 0, y: 0, w: 400, h: 400 }),
          link: { boardId: 'b2', nodeId: 'x9' },
        },
        node('n1', 'Своя', 'box', { x: 100, y: 100 }),
      ],
    });

    expect(findByName(tree, 'Своя.md')!.parentId).toBe(findByName(tree, 'Доска')!.id);
  });

  it('доска из одних связанных копий не заводит папку', () => {
    const ops = plan({
      name: 'Доска',
      nodes: [{ ...node('n1', 'Связанная'), link: { boardId: 'b2', nodeId: 'x1' } }],
    });

    expect(ops).toEqual([]);
  });

  it('дубликат просит перенести содержимое файла-оригинала', () => {
    const source: SpaceNode = {
      id: 'src-file',
      name: 'Оригинал.md',
      type: 'file',
      parentId: null,
      createdAt: now(),
      origin: { kind: 'node', boardId: 'b2', nodeId: 'x1' },
    };

    const ops = plan(
      {
        name: 'Доска',
        nodes: [{ ...node('n1', 'Оригинал'), copiedFrom: { boardId: 'b2', nodeId: 'x1' } }],
      },
      [source],
    );

    const created = ops.find((op) => op.type === 'create' && op.node.type === 'file');
    expect(created).toMatchObject({ copyContentFrom: 'src-file' });
  });

  it('дубликат исчезнувшего оригинала заводится пустым, а не падает', () => {
    const ops = plan({
      name: 'Доска',
      nodes: [{ ...node('n1', 'Копия'), copiedFrom: { boardId: 'gone', nodeId: 'x1' } }],
    });

    const created = ops.find((op) => op.type === 'create' && op.node.type === 'file');
    expect(created).toBeDefined();
    expect(created).not.toHaveProperty('copyContentFrom');
  });

  it('содержимое переносится только при создании: второй проход уже ничего не делает', () => {
    const source: SpaceNode = {
      id: 'src-file',
      name: 'Оригинал.md',
      type: 'file',
      parentId: null,
      createdAt: now(),
      origin: { kind: 'node', boardId: 'b2', nodeId: 'x1' },
    };
    const board = {
      name: 'Доска',
      nodes: [{ ...node('n1', 'Оригинал'), copiedFrom: { boardId: 'b2', nodeId: 'x1' } }],
    };

    const tree = sync(board, [source]);

    expect(plan(board, tree)).toEqual([]);
  });
});
