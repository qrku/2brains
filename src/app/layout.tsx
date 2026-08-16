import type { Metadata } from 'next';
import { AppProviders } from '@/app/providers/AppProviders';
import { AgentWidget } from '@/features/ai-agent';
import { Nav } from '@/widgets/nav';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import './globals.css';
import 'mikro-ui/tokens';
import 'mikro-ui/styles';

export const metadata: Metadata = {
  title: '2brain',
  description: 'Подготовка к собеседованию',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppProviders>
          <Nav />
          {children}
          <AgentWidget />
        </AppProviders>
      </body>
    </html>
  );
}
