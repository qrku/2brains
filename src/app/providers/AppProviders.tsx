'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from 'mikro-ui';
import { Provider as UrqlProvider } from 'urql';
import { gqlClient } from '@/shared/api/client';
import { WorkspaceStoreProvider, useWorkspaceStore } from '@/entities/workspace';
import { SpaceStoreProvider } from '@/entities/space';
import { ProfileStoreProvider } from '@/entities/profile';
import { AgentStoreProvider } from '@/features/ai-agent';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UrqlProvider value={gqlClient}>
      <WorkspaceStoreProvider>
        <WorkspaceScope>{children}</WorkspaceScope>
      </WorkspaceStoreProvider>
    </UrqlProvider>
  );
}

/**
 * Wiring the workspace into the stores it scopes.
 *
 * The stores themselves don't know about workspaces — they take the id as a prop, so no entity
 * depends on another. `null` means the workspace store hasn't hydrated yet: until it does,
 * nobody reads or writes storage, otherwise the default workspace's keys would be touched first
 * and then overwritten with the real one's data.
 */
function WorkspaceScope({ children }: { children: ReactNode }) {
  const { state } = useWorkspaceStore();
  const workspaceId = state.hydrated ? state.currentId : null;

  return (
    <SpaceStoreProvider workspaceId={workspaceId}>
      <AgentStoreProvider>
        <ProfileStoreProvider>
          {children}
          <ToastProvider />
        </ProfileStoreProvider>
      </AgentStoreProvider>
    </SpaceStoreProvider>
  );
}
