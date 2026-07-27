import { wsKey } from '@/shared/lib/workspace';
import type { BEdge, BNode, BoardDoc, BoardSettings, T } from '../model/types';
import { DEF_H, DEF_SETTINGS, DEF_VIEW, DEF_W } from '../model/constants';

const DOC_KEY      = 'board_data_v1';
const SETTINGS_KEY = 'board_settings_v1';
const VIEW_KEY     = 'board_view_v1';

/** What's actually on disk: documents written by older versions predate some fields. */
interface StoredDoc {
  nodes?: Partial<BNode>[];
  edges?: Partial<BEdge>[];
}

function read<R>(key: string, workspaceId: string, fallback: R): R {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(wsKey(key, workspaceId));
    return raw ? (JSON.parse(raw) as R) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, workspaceId: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(wsKey(key, workspaceId), JSON.stringify(value));
  } catch {
    // quota exceeded — silently ignore
  }
}

/** Nodes and edges predating later fields are backfilled with defaults on read. */
export function loadBoard(workspaceId: string): BoardDoc {
  const raw = read<StoredDoc | null>(DOC_KEY, workspaceId, null);
  if (!raw) return { nodes: [], edges: [] };
  return {
    nodes: (raw.nodes ?? []).map((n) => ({
      kind: 'box', fontSize: 13, shape: 'rect', w: DEF_W, h: DEF_H, ...n,
    } as BNode)),
    edges: (raw.edges ?? []).map((e) => ({ points: [], ...e } as BEdge)),
  };
}

export function saveBoard(doc: BoardDoc, workspaceId: string): void {
  write(DOC_KEY, workspaceId, doc);
}

export function loadBoardSettings(workspaceId: string): BoardSettings {
  return { ...DEF_SETTINGS, ...read<Partial<BoardSettings>>(SETTINGS_KEY, workspaceId, {}) };
}

export function saveBoardSettings(settings: BoardSettings, workspaceId: string): void {
  write(SETTINGS_KEY, workspaceId, settings);
}

export function loadBoardView(workspaceId: string): T {
  return { ...DEF_VIEW, ...read<Partial<T>>(VIEW_KEY, workspaceId, {}) };
}

export function saveBoardView(view: T, workspaceId: string): void {
  write(VIEW_KEY, workspaceId, view);
}
