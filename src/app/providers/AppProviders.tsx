'use client';

import { ToastProvider } from 'mikro-ui';
import { Provider as UrqlProvider } from 'urql';
import { gqlClient } from '@/shared/api/client';
import { WorkspaceStoreProvider }   from './WorkspaceStoreProvider';
import { SpaceStoreProvider }       from './SpaceStoreProvider';
import { AgentStoreProvider }       from './AgentStoreProvider';
import { ModulesStoreProvider }     from './ModulesStoreProvider';
import { InterviewStoreProvider }   from './InterviewStoreProvider';
import { ExperienceStoreProvider }  from './ExperienceStoreProvider';
import { ApplicationStoreProvider } from './ApplicationStoreProvider';
import { ProblemStoreProvider }     from './ProblemStoreProvider';
import { UserPacksStoreProvider }   from './UserPacksStoreProvider';
import { ProfileStoreProvider }     from './ProfileStoreProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UrqlProvider value={gqlClient}>
      <WorkspaceStoreProvider>
        <SpaceStoreProvider>
          <AgentStoreProvider>
            <ModulesStoreProvider>
              <InterviewStoreProvider>
                <ExperienceStoreProvider>
                  <ApplicationStoreProvider>
                    <ProblemStoreProvider>
                      <UserPacksStoreProvider>
                        <ProfileStoreProvider>
                          {children}
                          <ToastProvider />
                        </ProfileStoreProvider>
                      </UserPacksStoreProvider>
                    </ProblemStoreProvider>
                  </ApplicationStoreProvider>
                </ExperienceStoreProvider>
              </InterviewStoreProvider>
            </ModulesStoreProvider>
          </AgentStoreProvider>
        </SpaceStoreProvider>
      </WorkspaceStoreProvider>
    </UrqlProvider>
  );
}
