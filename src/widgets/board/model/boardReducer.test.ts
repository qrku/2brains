import { boardReducer, initialBoardState } from './boardReducer';
import { mkNode } from '@/entities/board';
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
