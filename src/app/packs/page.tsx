import type { Metadata } from 'next';
import { PackGrid } from '@/widgets/pack-list';

export const metadata: Metadata = { title: 'Паки — 2brain' };

export default function PacksPage() {
  return (
    <main>
      <div className="container">
        <div className="header">
          <h1>Паки</h1>
          <p>Выбери тему или создай свой пак</p>
        </div>
        <PackGrid />
      </div>
    </main>
  );
}
