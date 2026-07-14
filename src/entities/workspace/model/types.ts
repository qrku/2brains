export interface Workspace {
  id: string;
  name: string;
}

export const DEFAULT_WORKSPACE: Workspace = { id: 'personal', name: 'Personal' };
