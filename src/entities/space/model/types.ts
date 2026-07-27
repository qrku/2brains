export interface SpaceNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  createdAt: string;
}

export interface SpaceState {
  hydrated: boolean;
  nodes: SpaceNode[];
  openFileId: string | null;
  expanded: string[];
}

export type SpaceAction =
  | { type: 'HYDRATE'; nodes: SpaceNode[]; expanded: string[]; openFileId: string | null }
  | { type: 'ADD_NODE'; node: SpaceNode }
  | { type: 'MOVE_NODE'; id: string; parentId: string | null }
  | { type: 'DELETE_NODE'; id: string; descendants: string[] }
  | { type: 'RENAME_NODE'; id: string; name: string }
  | { type: 'OPEN_FILE'; id: string }
  | { type: 'TOGGLE_FOLDER'; id: string };
