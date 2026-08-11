import { DEFAULT_WORKSPACE_ID } from '@/shared/lib/workspace';

export interface Workspace {
  id: string;
  name: string;
}

export const DEFAULT_WORKSPACE: Workspace = { id: DEFAULT_WORKSPACE_ID, name: 'Personal' };
