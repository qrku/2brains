'use client';

import { useInterviewStore } from '@/entities/interview';
import { CreateInterviewButton } from '@/features/create-interview';
import { InterviewListCard } from './InterviewListCard';

export function InterviewList() {
  const { state } = useInterviewStore();

  if (!state.hydrated) {
    return (
      <div>
        <div className="page-toolbar">
          <div className="skeleton" style={{ width: 140, height: 26, borderRadius: 3 }} />
        </div>
        <div className="iv-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="iv-card">
              <div className="iv-card-body">
                <div className="skeleton" style={{ width: 160, height: 14, marginBottom: 6, borderRadius: 3 }} />
                <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-toolbar">
        <CreateInterviewButton />
      </div>

      {state.interviews.length === 0 ? (
        <div className="empty-state">
          <p style={{ marginBottom: 4 }}>Тестов пока нет</p>
          <p>Создай первый — добавь вопросы и тренируйся отвечать на них</p>
        </div>
      ) : (
        <div className="iv-list">
          {state.interviews.map((iv) => (
            <InterviewListCard key={iv.id} interview={iv} />
          ))}
        </div>
      )}
    </div>
  );
}
