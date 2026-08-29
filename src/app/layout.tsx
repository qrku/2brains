import type { Metadata, Viewport } from 'next';
import { AppProviders } from '@/app/providers/AppProviders';
import { AgentWidget } from '@/features/ai-agent';
import { Nav } from '@/widgets/nav';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import './globals.css';
import 'mikro-ui/tokens';
import 'mikro-ui/styles';

export const metadata: Metadata = {
  title: '2brains',
  description: 'Подготовка к собеседованию',
};

/**
 * Без этого мобильный Safari рисует страницу в виртуальном окне 980 px и ужимает
 * её целиком — все медиазапросы ниже просто не срабатывают.
 *
 * Зум пользователя намеренно не запрещён: доска ставит `touch-action: none`
 * только на свой холст, а тексту и формам масштабирование нужно оставить.
 * Чтобы Safari не наезжал на поля сам, у них с телефона шрифт не мельче 16px
 * (см. блок про порог iOS в globals.css) — запрещать зум ради этого не нужно.
 * `viewportFit: cover` отдаёт нам области под «чёлкой», а safe-area-отступы
 * добавляют те элементы, которые прижаты к краям.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
