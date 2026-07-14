import type { Metadata } from 'next';
import { ModulesGrid } from '@/widgets/modules';

export const metadata: Metadata = { title: 'Модули — 2brain' };

export default function ModulesPage() {
  return (
    <main>
      <div className="container">
        <div className="header">
          <h1>Модули</h1>
          <p>Включи дополнительные разделы и переходи к ним отсюда</p>
        </div>
        <ModulesGrid />
      </div>
    </main>
  );
}
