import type { Metadata } from 'next';
import { AppProviders } from '@/app/providers/AppProviders';
import { Nav } from '@/shared/ui/Nav';
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
        <AppProviders>
          <Nav />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
