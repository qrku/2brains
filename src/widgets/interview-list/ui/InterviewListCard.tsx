'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, toast } from 'mikro-ui';
import { useInterviewStore } from '@/app/providers/InterviewStoreProvider';
import { PracticeModal } from '@/features/practice-mode';
import type { Interview } from '@/entities/interview';

interface Props {
  interview: Interview;
}

export function InterviewListCard({ interview }: Props) {
  const { dispatch } = useInterviewStore();
  const [practicing, setPracticing] = useState(false);

  const date = new Date(interview.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
  const count = interview.questions.length;

  const handleDelete = () => {
    if (!confirm(`Удалить «${interview.title}»?`)) return;
    dispatch({ type: 'DELETE_INTERVIEW', id: interview.id });
    toast.success('Тест удалён');
  };

  return (
    <>
      <div className="iv-card">
        <div className="iv-card-body">
          <div className="iv-card-title">{interview.title}</div>
          <div className="iv-card-meta">
            {count === 0 ? 'Нет вопросов' : `${count} ${pluralQ(count)}`} · {date}
          </div>
        </div>

        <div className="iv-card-actions">
          {count > 0 && (
            <Button size="sm" variant="outline" onClick={() => setPracticing(true)}>
              ▶ Практика
            </Button>
          )}
          <Link href={`/tests/${interview.id}`} className="btn-link">
            Открыть
          </Link>
          <button className="icon-btn danger" onClick={handleDelete}>✕</button>
        </div>
      </div>

      {practicing && (
        <PracticeModal
          title={interview.title}
          questions={interview.questions}
          onClose={() => setPracticing(false)}
        />
      )}
    </>
  );
}

function pluralQ(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'вопрос';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'вопроса';
  return 'вопросов';
}
