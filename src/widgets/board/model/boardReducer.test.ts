import { boardReducer, initialBoardState } from './boardReducer';
import { mkNode, type BNode } from '@/entities/board';
import type { BoardState, PointerPos } from './types';

const pos = (x: number, y: number): PointerPos => ({ sx: x, sy: y, clientX: x, clientY: y });

function withNode(): { state: BoardState; id: string } {
  const node = mkNode('n1', 0, 0, 160, 90, 'box');
  const state: BoardState = {
    ...initialBoardState,
    ready: true,
    nodes: [node],
    selected: [node.id],
  };
  return { state, id: node.id };
}

function startResize(state: BoardState, id: string): BoardState {
  const node = state.nodes.find((n) => n.id === id)!;
  return boardReducer(state, {
    type: 'DRAG_START',
    drag: {
      type: 'resize',
      id,
      edge: 'se',
      startX: 0,
      startY: 0,
      origin: { x: node.x, y: node.y, w: node.w, h: node.h },
    },
  });
}

describe('boardReducer — ресайз ноды, удалённой посреди жеста', () => {
  it('не падает на DRAG_MOVE, если ноды больше нет', () => {
    const { state, id } = withNode();
    const resizing = startResize(state, id);
    const deleted = boardReducer(resizing, { type: 'DELETE_SELECTION' });
    expect(deleted.nodes).toHaveLength(0);

    expect(() => boardReducer(deleted, { type: 'DRAG_MOVE', pos: pos(50, 50) })).not.toThrow();
    expect(boardReducer(deleted, { type: 'DRAG_MOVE', pos: pos(50, 50) }).nodes).toHaveLength(0);
  });

  it('обычный ресайз по-прежнему меняет размер', () => {
    const { state, id } = withNode();
    const before = state.nodes[0];
    const moved = boardReducer(startResize(state, id), { type: 'DRAG_MOVE', pos: pos(60, 40) });

    const after = moved.nodes.find((n) => n.id === id)!;
    expect(after.w).toBeGreaterThan(before.w);
    expect(after.h).toBeGreaterThan(before.h);
  });
});

/* ── Копирование между досками ────────────────────────────────────────── */

function boardWith(nodes: BNode[], selected: string[] = []): BoardState {
  return { ...initialBoardState, ready: true, boardId: 'b1', nodes, selected };
}

const box = (id: string, x = 0, y = 0) => ({ ...mkNode(id, x, y, 100, 50, 'box'), text: id });

describe('boardReducer — COPY', () => {
  it('запоминает доску-источник', () => {
    const state = boardWith([box('n1')], ['n1']);

    expect(boardReducer(state, { type: 'COPY' }).clipboard).toMatchObject({ boardId: 'b1' });
  });

  it('копирует фрейм вместе с его содержимым', () => {
    const frame = { ...mkNode('f1', 0, 0, 400, 400, 'frame'), text: 'Фрейм' };
    const inside = box('n1', 100, 100);
    const outside = box('n2', 900, 900);
    const state = boardWith([frame, inside, outside], ['f1']);

    const ids = boardReducer(state, { type: 'COPY' }).clipboard!.nodes.map((n) => n.id);

    expect(ids).toEqual(expect.arrayContaining(['f1', 'n1']));
    expect(ids).not.toContain('n2');
  });

  it('без выделения буфер не трогается', () => {
    const state = boardWith([box('n1')]);

    expect(boardReducer(state, { type: 'COPY' }).clipboard).toBeNull();
  });
});

describe('boardReducer — PASTE', () => {
  const copied = boardReducer(boardWith([box('n1')], ['n1']), { type: 'COPY' });

  /** Тот же буфер, но вставляем его уже на другой доске. */
  const onOtherBoard: BoardState = { ...copied, boardId: 'b2', nodes: [], selected: [] };

  it('дубликат не ссылается на оригинал, но помнит, откуда взят', () => {
    const pasted = boardReducer(onOtherBoard, { type: 'PASTE', at: null, mode: 'duplicate' });
    const node = pasted.nodes[0];

    expect(node.link).toBeUndefined();
    expect(node.copiedFrom).toEqual({ boardId: 'b1', nodeId: 'n1' });
    expect(node.id).not.toBe('n1');
  });

  it('связанная копия ссылается на оригинал и не считается дубликатом', () => {
    const pasted = boardReducer(onOtherBoard, { type: 'PASTE', at: null, mode: 'link' });
    const node = pasted.nodes[0];

    expect(node.link).toEqual({ boardId: 'b1', nodeId: 'n1' });
    expect(node.copiedFrom).toBeUndefined();
  });

  it('на своей же доске связывание сводится к дубликату', () => {
    const pasted = boardReducer(copied, { type: 'PASTE', at: null, mode: 'link' });

    expect(pasted.nodes.find((n) => n.id !== 'n1')!.link).toBeUndefined();
  });

  it('копия связанной копии ссылается на первоисточник, а не на середину цепочки', () => {
    const linked = boardReducer(onOtherBoard, { type: 'PASTE', at: null, mode: 'link' });
    const linkedId = linked.nodes[0].id;

    const recopied = boardReducer({ ...linked, selected: [linkedId] }, { type: 'COPY' });
    const onThird: BoardState = { ...recopied, boardId: 'b3', nodes: [], selected: [] };
    const pasted = boardReducer(onThird, { type: 'PASTE', at: null, mode: 'link' });

    expect(pasted.nodes[0].link).toEqual({ boardId: 'b1', nodeId: 'n1' });
  });

  it('дубликат связанной копии берёт содержимое первоисточника', () => {
    const linked = boardReducer(onOtherBoard, { type: 'PASTE', at: null, mode: 'link' });
    const linkedId = linked.nodes[0].id;

    const recopied = boardReducer({ ...linked, selected: [linkedId] }, { type: 'COPY' });
    const onThird: BoardState = { ...recopied, boardId: 'b3', nodes: [], selected: [] };
    const pasted = boardReducer(onThird, { type: 'PASTE', at: null, mode: 'duplicate' });

    expect(pasted.nodes[0].link).toBeUndefined();
    expect(pasted.nodes[0].copiedFrom).toEqual({ boardId: 'b1', nodeId: 'n1' });
  });
});

describe('boardReducer — UNLINK', () => {
  const linkedState = (): BoardState =>
    boardWith(
      [{ ...box('n1'), text: 'снимок при вставке', link: { boardId: 'b2', nodeId: 'x1' } }],
      ['n1'],
    );

  it('снимает связь и превращает ноду в самостоятельную копию', () => {
    const next = boardReducer(linkedState(), {
      type: 'UNLINK',
      items: [{ id: 'n1', text: 'Кэширование' }],
    });
    const node = next.nodes[0];

    expect(node.link).toBeUndefined();
    expect(node.copiedFrom).toEqual({ boardId: 'b2', nodeId: 'x1' });
  });

  it('подпись берётся из переданной, а не из устаревшего снимка', () => {
    const next = boardReducer(linkedState(), {
      type: 'UNLINK',
      items: [{ id: 'n1', text: 'Кэширование' }],
    });

    expect(next.nodes[0].text).toBe('Кэширование');
  });

  it('обычную ноду не трогает', () => {
    const state = boardWith([box('n1')], ['n1']);

    const next = boardReducer(state, { type: 'UNLINK', items: [{ id: 'n1', text: 'Другое' }] });

    expect(next.nodes[0]).toEqual(state.nodes[0]);
  });

  it('пустой список — состояние то же самое', () => {
    const state = linkedState();

    expect(boardReducer(state, { type: 'UNLINK', items: [] })).toBe(state);
  });
});
