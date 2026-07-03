import type { Metadata } from 'next';
import { ProblemList } from '@/widgets/problem-list';

export const metadata: Metadata = { title: 'Задачи — 2brain' };

export default function ProblemsPage() {
  return (
    <main>
      <div className="container">
        <div className="header">
          <h1>Задачи</h1>
          <p>Алгоритмические задачи и паттерны</p>
        </div>
        <ProblemList />
      </div>
    </main>
  );
}
