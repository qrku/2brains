import { wsKey } from '@/shared/lib/workspace';
import type { SpaceNode } from '../model/types';

const NODES_KEY = 'space_nodes_v1';
const META_KEY = 'space_meta_v1';

/** What the tree remembers between visits, apart from the nodes themselves. */
export interface SpaceMeta {
  expanded: string[];
  openFileId: string | null;
}

/** Nodes of any workspace, including ones not currently loaded into the store. */
export function spaceReadNodes(workspaceId: string): SpaceNode[] {
  try {
    return JSON.parse(localStorage.getItem(wsKey(NODES_KEY, workspaceId)) ?? '[]') as SpaceNode[];
  } catch {
    return [];
  }
}

export function spaceSaveNodes(nodes: SpaceNode[], workspaceId: string): void {
  try {
    localStorage.setItem(wsKey(NODES_KEY, workspaceId), JSON.stringify(nodes));
  } catch {}
}

export function spaceReadMeta(workspaceId: string): SpaceMeta {
  try {
    const raw = JSON.parse(
      localStorage.getItem(wsKey(META_KEY, workspaceId)) ?? '{}',
    ) as Partial<SpaceMeta>;
    return { expanded: raw.expanded ?? [], openFileId: raw.openFileId ?? null };
  } catch {
    return { expanded: [], openFileId: null };
  }
}

export function spaceSaveMeta(meta: SpaceMeta, workspaceId: string): void {
  try {
    localStorage.setItem(wsKey(META_KEY, workspaceId), JSON.stringify(meta));
  } catch {}
}

// Content helpers — read/write directly to avoid putting large strings in React state.
// Callers must pass the current workspace id so content stays isolated per workspace.
export const spaceReadContent = (id: string, workspaceId: string): string => {
  try {
    return localStorage.getItem(wsKey(`space_file_${id}`, workspaceId)) ?? '';
  } catch {
    return '';
  }
};
export const spaceSaveContent = (id: string, text: string, workspaceId: string) => {
  try {
    localStorage.setItem(wsKey(`space_file_${id}`, workspaceId), text);
  } catch {}
};
export const spaceDeleteContent = (id: string, workspaceId: string) => {
  try {
    localStorage.removeItem(wsKey(`space_file_${id}`, workspaceId));
  } catch {}
};
