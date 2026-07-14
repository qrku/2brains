import { DEFAULT_WORKSPACE } from '@/entities/workspace';

/**
 * Namespaces a storage key by workspace so each workspace's data stays isolated.
 * The default workspace keeps unprefixed keys so existing local data isn't lost.
 */
export function wsKey(base: string, workspaceId: string): string {
  return workspaceId === DEFAULT_WORKSPACE.id ? base : `ws_${workspaceId}__${base}`;
}
