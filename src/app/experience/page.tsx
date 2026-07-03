import type { Metadata } from 'next';
import { ExperienceList } from '@/widgets/experience-list';

export const metadata: Metadata = { title: 'Опыт — 2brain' };

export default function ExperiencePage() {
  return (
    <main>
      <div className="container">
        <div className="header">
          <h1>Опыт</h1>
          <p>Детали проектов для рассказа на интервью</p>
        </div>
        <ExperienceList />
      </div>
    </main>
  );
}
