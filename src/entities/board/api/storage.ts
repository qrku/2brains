import { wsKey } from '@/shared/lib/workspace';
import type { BEdge, BNode, BoardDoc, BoardMeta, BoardSettings, T } from '../model/types';
import { DEF_H, DEF_SETTINGS, DEF_VIEW, DEF_W } from '../model/constants';

const DOC_KEY      = 'board_data_v1';
const SETTINGS_KEY = 'board_settings_v1';
const VIEW_KEY     = 'board_view_v1';
const LIST_KEY     = 'board_list_v1';
const CURRENT_KEY  = 'board_current_v1';

/** Every workspace starts with this one board; boards created later get generated ids. */
export const DEFAULT_BOARD_ID = 'main';
export const DEFAULT_BOARD_NAME = 'Доска';

/**
 * Namespaces a storage key by board, the same way `wsKey` does by workspace.
 * The first board keeps the unprefixed keys, so boards drawn before this existed stay where they are.
 */
function boardKey(base: string, boardId: string): string {
  return boardId === DEFAULT_BOARD_ID ? base : `${base}__b_${boardId}`;
}

/** What's actually on disk: documents written by older versions predate some fields. */
interface StoredDoc {
  nodes?: Partial<BNode>[];
  edges?: Partial<BEdge>[];
}

function read<R>(key: string, fallback: R): R {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as R) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded — silently ignore
  }
}

const docKey      = (ws: string, board: string) => wsKey(boardKey(DOC_KEY, board), ws);
const settingsKey = (ws: string, board: string) => wsKey(boardKey(SETTINGS_KEY, board), ws);
const viewKey     = (ws: string, board: string) => wsKey(boardKey(VIEW_KEY, board), ws);

/* ── Board list ─────────────────────────────────────────────────────────── */

export function defaultBoardMeta(): BoardMeta {
  return { id: DEFAULT_BOARD_ID, name: DEFAULT_BOARD_NAME, createdAt: new Date().toISOString() };
}

/**
 * The list as saved, or `null` for a workspace whose boards were never touched.
 * Callers that just need boards to show should use `loadBoardList`.
 */
function readBoardList(workspaceId: string): BoardMeta[] | null {
  const list = read<BoardMeta[] | null>(wsKey(LIST_KEY, workspaceId), null);
  return Array.isArray(list) && list.length > 0 ? list : null;
}

export function loadBoardList(workspaceId: string): BoardMeta[] {
  return readBoardList(workspaceId) ?? [defaultBoardMeta()];
}

export function saveBoardList(list: BoardMeta[], workspaceId: string): void {
  write(wsKey(LIST_KEY, workspaceId), list);
}

export function loadCurrentBoardId(workspaceId: string, list: BoardMeta[]): string {
  const saved = read<string | null>(wsKey(CURRENT_KEY, workspaceId), null);
  return saved && list.some((b) => b.id === saved) ? saved : list[0].id;
}

export function saveCurrentBoardId(boardId: string, workspaceId: string): void {
  write(wsKey(CURRENT_KEY, workspaceId), boardId);
}

/** Drops everything a board owns. The list entry is the caller's to remove. */
export function deleteBoardData(workspaceId: string, boardId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(docKey(workspaceId, boardId));
    localStorage.removeItem(settingsKey(workspaceId, boardId));
    localStorage.removeItem(viewKey(workspaceId, boardId));
  } catch {
    // nothing to clean up
  }
}

/**
 * Boards a workspace actually has. An untouched workspace counts zero: its implicit first board
 * only becomes real once something is drawn on it.
 */
export function countBoards(workspaceId: string): number {
  const list = readBoardList(workspaceId);
  if (list) return list.length;
  return loadBoard(workspaceId, DEFAULT_BOARD_ID).nodes.length > 0 ? 1 : 0;
}

/* ── Board document ─────────────────────────────────────────────────────── */

/** Nodes and edges predating later fields are backfilled with defaults on read. */
export function loadBoard(workspaceId: string, boardId: string): BoardDoc {
  const raw = read<StoredDoc | null>(docKey(workspaceId, boardId), null);
  if (!raw) return { nodes: [], edges: [] };
  return {
    nodes: (raw.nodes ?? []).map((n) => ({
      kind: 'box', fontSize: 13, shape: 'rect', w: DEF_W, h: DEF_H, ...n,
    } as BNode)),
    edges: (raw.edges ?? []).map((e) => ({ points: [], ...e } as BEdge)),
  };
}

export function saveBoard(doc: BoardDoc, workspaceId: string, boardId: string): void {
  write(docKey(workspaceId, boardId), doc);
}

export function loadBoardSettings(workspaceId: string, boardId: string): BoardSettings {
  return { ...DEF_SETTINGS, ...read<Partial<BoardSettings>>(settingsKey(workspaceId, boardId), {}) };
}

export function saveBoardSettings(settings: BoardSettings, workspaceId: string, boardId: string): void {
  write(settingsKey(workspaceId, boardId), settings);
}

export function loadBoardView(workspaceId: string, boardId: string): T {
  return { ...DEF_VIEW, ...read<Partial<T>>(viewKey(workspaceId, boardId), {}) };
}

export function saveBoardView(view: T, workspaceId: string, boardId: string): void {
  write(viewKey(workspaceId, boardId), view);
}
