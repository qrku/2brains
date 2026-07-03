import { InterviewList } from '@/widgets/interview-list';

export default function InterviewsPage() {
  return (
    <main>
      <div className="container">
        <div className="header">
          <h1>Интервью</h1>
          <p>Сохраняй вопросы и тренируйся перед следующим собесом</p>
        </div>
        <InterviewList />
      </div>
    </main>
  );
}
