'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, toast } from 'mikro-ui';
import { useInterviewStore } from '@/entities/interview';
import { QuestionCard, AddQuestionForm } from '@/features/manage-questions';
import { PracticeModal } from '@/features/practice-mode';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  id: string;
}

export function InterviewDetail({ id }: Props) {
  const { state, dispatch } = useInterviewStore();
  const [practicing, setPracticing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  if (!state.hydrated) {
    return (
      <div className="container">
        <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 3, marginBottom: 28 }} />
        <div className="skeleton" style={{ width: 260, height: 22, borderRadius: 3, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 3, marginBottom: 32 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="q-card">
            <span className="q-card-index skeleton" style={{ width: 16, height: 12, borderRadius: 2 }} />
            <div className="q-card-body">
              <div className="skeleton" style={{ width: '65%', height: 13, borderRadius: 3, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '85%', height: 36, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const interview = state.interviews.find((iv) => iv.id === id);

  if (!interview) {
    return (
      <div className="container">
        <Link href="/tests" className="btn-link ghost" style={{ marginBottom: 28, display: 'inline-flex' }}>
          <Icon name="arrow-back" size={12} /> Назад
        </Link>
        <div className="empty-state" style={{ marginTop: 64 }}>Тест не найден</div>
      </div>
    );
  }

  const saveTitle = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== interview.title) {
      dispatch({ type: 'UPDATE_TITLE', id, title: trimmed });
      toast.success('Название обновлено');
    }
    setEditingTitle(false);
  };

  return (
    <>
      <div className="container">
        <Link href="/tests" className="btn-link ghost" style={{ marginBottom: 24, display: 'inline-flex' }}>
          <Icon name="arrow-back" size={12} /> Тесты
        </Link>

        <div className="detail-header">
          {editingTitle ? (
            <div className="title-edit-row">
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                autoFocus
                style={{ fontSize: 18 }}
              />
              <Button size="sm" onClick={saveTitle}>Сохранить</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>Отмена</Button>
            </div>
          ) : (
            <div className="title-view-row">
              <h1 className="detail-title">{interview.title}</h1>
              <button
                className="icon-btn"
                title="Переименовать"
                onClick={() => { setDraftTitle(interview.title); setEditingTitle(true); }}
              >
                <Icon name="edit-01" size={12} />
              </button>
            </div>
          )}

          <div className="detail-meta">
            <span>
              {interview.questions.length === 0
                ? 'Нет вопросов'
                : `${interview.questions.length} ${pluralQ(interview.questions.length)}`}
            </span>
            {interview.questions.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setPracticing(true)}>
                <Icon name="arrow-forward" size={11} /> Начать практику
              </Button>
            )}
          </div>
        </div>

        <div className="q-list">
          {interview.questions.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 24 }}>
              Добавь первый вопрос
            </div>
          ) : (
            interview.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                interviewId={id}
                question={q}
                index={i + 1}
              />
            ))
          )}
        </div>

        <AddQuestionForm interviewId={id} />
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
