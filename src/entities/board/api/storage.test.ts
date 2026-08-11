import { DEFAULT_WORKSPACE_ID } from '@/shared/lib/workspace';
import {
  DEFAULT_BOARD_ID,
  countBoards,
  defaultBoardMeta,
  deleteBoardData,
  loadBoard,
  loadBoardList,
  loadCurrentBoardId,
  saveBoard,
  saveBoardList,
  saveCurrentBoardId,
} from './storage';
import { mkNode } from '../lib/factory';

const WS = DEFAULT_WORKSPACE_ID;
const OTHER_WS = 'ws-2';

const doc = (id: string) => ({ nodes: [mkNode(id, 0, 0, 160, 90, 'box')], edges: [] });

beforeEach(() => localStorage.clear());

describe('board storage keys', () => {
  it('keeps the first board on the legacy unprefixed key', () => {
    saveBoard(doc('n1'), WS, DEFAULT_BOARD_ID);
    expect(localStorage.getItem('board_data_v1')).toContain('n1');
  });

  it('gives every other board its own key', () => {
    saveBoard(doc('n1'), WS, DEFAULT_BOARD_ID);
    saveBoard(doc('n2'), WS, 'b2');

    expect(loadBoard(WS, DEFAULT_BOARD_ID).nodes[0].id).toBe('n1');
    expect(loadBoard(WS, 'b2').nodes[0].id).toBe('n2');
  });

  it('keeps boards of different workspaces apart', () => {
    saveBoard(doc('n1'), WS, 'b2');
    saveBoard(doc('n2'), OTHER_WS, 'b2');

    expect(loadBoard(WS, 'b2').nodes[0].id).toBe('n1');
    expect(loadBoard(OTHER_WS, 'b2').nodes[0].id).toBe('n2');
  });

  it('deleting a board leaves the others alone', () => {
    saveBoard(doc('n1'), WS, DEFAULT_BOARD_ID);
    saveBoard(doc('n2'), WS, 'b2');

    deleteBoardData(WS, 'b2');

    expect(loadBoard(WS, 'b2').nodes).toHaveLength(0);
    expect(loadBoard(WS, DEFAULT_BOARD_ID).nodes[0].id).toBe('n1');
  });
});

describe('board list', () => {
  it('falls back to a single default board', () => {
    expect(loadBoardList(WS)).toEqual([expect.objectContaining({ id: DEFAULT_BOARD_ID })]);
  });

  it('ignores a saved current id that no longer exists', () => {
    const list = [defaultBoardMeta()];
    saveCurrentBoardId('gone', WS);
    expect(loadCurrentBoardId(WS, list)).toBe(DEFAULT_BOARD_ID);
  });

  it('remembers the open board per workspace', () => {
    const list = [defaultBoardMeta(), { id: 'b2', name: 'Доска 2', createdAt: '' }];
    saveCurrentBoardId('b2', WS);

    expect(loadCurrentBoardId(WS, list)).toBe('b2');
    expect(loadCurrentBoardId(OTHER_WS, list)).toBe(DEFAULT_BOARD_ID);
  });
});

describe('countBoards', () => {
  it('counts nothing for a workspace whose board was never used', () => {
    expect(countBoards(WS)).toBe(0);
  });

  it('counts the implicit first board once something is on it', () => {
    saveBoard(doc('n1'), WS, DEFAULT_BOARD_ID);
    expect(countBoards(WS)).toBe(1);
  });

  it('counts every board in a saved list, empty or not', () => {
    saveBoardList([defaultBoardMeta(), { id: 'b2', name: 'Доска 2', createdAt: '' }], WS);
    expect(countBoards(WS)).toBe(2);
  });
});
