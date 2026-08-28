import { saveBoard, type BNode, type BoardMeta } from '@/entities/board';
import { findFileUsage } from './usage';

const WS = 'ws1';

const meta = (id: string, name: string): BoardMeta => ({
  id,
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const node = (id: string, extra: Partial<BNode> = {}): BNode => ({
  id,
  x: 0,
  y: 0,
  w: 100,
  h: 50,
  text: id,
  kind: 'box',
  fontSize: 13,
  shape: 'rect',
  ...extra,
});

/** Оригинал живёт на доске b1 нодой n1; b2 и b3 ссылаются на неё. */
const ORIGIN = { boardId: 'b1', nodeId: 'n1' };

beforeEach(() => {
  localStorage.clear();
  saveBoard({ nodes: [node('n1')], edges: [] }, WS, 'b1');
  saveBoard({ nodes: [node('local', { link: ORIGIN })], edges: [] }, WS, 'b2');
  saveBoard({ nodes: [node('other')], edges: [] }, WS, 'b3');
});

const boards = [meta('b1', 'Архитектура'), meta('b2', 'Роадмап'), meta('b3', 'Чужая')];

describe('findFileUsage', () => {
  it('находит доску-владельца и все ссылающиеся на неё', () => {
    const usage = findFileUsage(WS, boards, ORIGIN);

    expect(usage.map((u) => u.boardId)).toEqual(['b1', 'b2']);
  });

  it('владелец идёт первым и помечен', () => {
    const [first, second] = findFileUsage(WS, boards, ORIGIN);

    expect(first).toMatchObject({ boardId: 'b1', owner: true, nodeId: 'n1' });
    expect(second).toMatchObject({ boardId: 'b2', owner: false, nodeId: 'local' });
  });

  it('доски без этой ноды в список не попадают', () => {
    expect(findFileUsage(WS, boards, ORIGIN).some((u) => u.boardId === 'b3')).toBe(false);
  });

  it('нода с тем же id на другой доске не считается владельцем', () => {
    saveBoard({ nodes: [node('n1')], edges: [] }, WS, 'b3');

    expect(findFileUsage(WS, boards, ORIGIN).map((u) => u.boardId)).toEqual(['b1', 'b2']);
  });

  it('открытая доска берётся из памяти, а не с диска', () => {
    // На диске у b3 ссылки нет — она появилась только что и ещё не сохранена.
    const usage = findFileUsage(WS, boards, ORIGIN, {
      boardId: 'b3',
      nodes: [node('fresh', { link: ORIGIN })],
    });

    expect(usage.map((u) => u.boardId)).toEqual(['b1', 'b2', 'b3']);
  });

  it('у файла без связей остаётся одна доска — своя', () => {
    expect(findFileUsage(WS, boards, { boardId: 'b3', nodeId: 'other' })).toHaveLength(1);
  });
});
