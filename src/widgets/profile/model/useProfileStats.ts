'use client';

import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/app/providers/WorkspaceStoreProvider';
import { useSpaceStore, spaceReadNodes } from '@/app/providers/SpaceStoreProvider';
import { countBoards } from '@/entities/board';

export interface ProfileStatsData {
  workspaces: number;
  files: number;
  boards: number;
}

const EMPTY: ProfileStatsData = { workspaces: 0, files: 0, boards: 0 };

/**
 * Totals across every workspace, not just the current one.
 * Counts come from localStorage, so they start at zero and fill in after mount —
 * that keeps SSR and the first client render identical.
 */
export function useProfileStats(): ProfileStatsData {
  const { state: wsState } = useWorkspaceStore();
  const { state: spaceState } = useSpaceStore();
  const [stats, setStats] = useState<ProfileStatsData>(EMPTY);

  useEffect(() => {
    if (!wsState.hydrated) return;

    let files = 0;
    let boards = 0;

    for (const ws of wsState.workspaces) {
      // The current workspace is read from the store: its nodes may be newer than what's on disk.
      const nodes = ws.id === wsState.currentId ? spaceState.nodes : spaceReadNodes(ws.id);
      files += nodes.filter((n) => n.type === 'file').length;
      boards += countBoards(ws.id);
    }

    setStats({ workspaces: wsState.workspaces.length, files, boards });
  }, [wsState.hydrated, wsState.workspaces, wsState.currentId, spaceState.nodes]);

  return stats;
}
