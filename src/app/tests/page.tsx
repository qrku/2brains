import type { Metadata } from 'next';
import { InterviewList } from '@/widgets/interview-list';

export const metadata: Metadata = { title: 'Тесты — 2brain' };

export default function TestsPage() {
  return (
    <main>
      <div className="container">
        <div className="header">
          <h1>Тесты</h1>
          <p>Создавай наборы вопросов и проверяй знания</p>
        </div>
        <InterviewList />
      </div>
    </main>
  );
}
