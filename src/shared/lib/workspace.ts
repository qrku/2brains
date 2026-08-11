/**
 * The workspace every install starts with. Lives here rather than in the workspace entity
 * because `wsKey` — used by half a dozen entities — needs it, and shared can't import upwards.
 * `entities/workspace` builds the full `Workspace` object on top of this id.
 */
export const DEFAULT_WORKSPACE_ID = 'personal';

/**
 * Namespaces a storage key by workspace so each workspace's data stays isolated.
 * The default workspace keeps unprefixed keys so existing local data isn't lost.
 */
export function wsKey(base: string, workspaceId: string): string {
  return workspaceId === DEFAULT_WORKSPACE_ID ? base : `ws_${workspaceId}__${base}`;
}
