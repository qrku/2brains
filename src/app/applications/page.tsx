import type { Metadata } from 'next';
import { ApplicationList } from '@/widgets/application-list';

export const metadata: Metadata = { title: 'Отклики — 2brain' };

export default function ApplicationsPage() {
  return (
    <main>
      <div className="container">
        <div className="header">
          <h1>Отклики</h1>
          <p>Вакансии и статус собеседований</p>
        </div>
        <ApplicationList />
      </div>
    </main>
  );
}
