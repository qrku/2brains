'use client';

import { ToastProvider } from 'mikro-ui';
import { SpaceStoreProvider }       from './SpaceStoreProvider';
import { ModulesStoreProvider }     from './ModulesStoreProvider';
import { InterviewStoreProvider }   from './InterviewStoreProvider';
import { ExperienceStoreProvider }  from './ExperienceStoreProvider';
import { ApplicationStoreProvider } from './ApplicationStoreProvider';
import { ProblemStoreProvider }     from './ProblemStoreProvider';
import { UserPacksStoreProvider }   from './UserPacksStoreProvider';
import { ProfileStoreProvider }     from './ProfileStoreProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SpaceStoreProvider>
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
    </SpaceStoreProvider>
  );
}
