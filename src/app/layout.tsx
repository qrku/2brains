import type { Metadata } from 'next';
import { InterviewStoreProvider } from '@/app/providers/InterviewStoreProvider';
import { ExperienceStoreProvider } from '@/app/providers/ExperienceStoreProvider';
import { ApplicationStoreProvider } from '@/app/providers/ApplicationStoreProvider';
import { ProblemStoreProvider } from '@/app/providers/ProblemStoreProvider';
import { UserPacksStoreProvider } from '@/app/providers/UserPacksStoreProvider';
import { ProfileStoreProvider } from '@/app/providers/ProfileStoreProvider';
import { ModulesStoreProvider } from '@/app/providers/ModulesStoreProvider';
import { SpaceStoreProvider } from '@/app/providers/SpaceStoreProvider';
import { Nav } from '@/shared/ui/Nav';
import { ToastProvider } from 'mikro-ui';
import './globals.css';
import 'mikro-ui/tokens';
import 'mikro-ui/styles';

export const metadata: Metadata = {
  title: '2brain',
  description: 'Подготовка к собеседованию',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <SpaceStoreProvider>
        <ModulesStoreProvider>
          <InterviewStoreProvider>
            <ExperienceStoreProvider>
              <ApplicationStoreProvider>
                <ProblemStoreProvider>
                  <UserPacksStoreProvider>
                    <ProfileStoreProvider>
                      <Nav />
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
      </body>
    </html>
  );
}
