'use client';

import { useState } from 'react';
import { Textarea, Button, toast } from 'mikro-ui';
import { useInterviewStore } from '@/app/providers/InterviewStoreProvider';
import type { Question } from '@/entities/interview';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  interviewId: string;
  question: Question;
  index: number;
}

export function QuestionCard({ interviewId, question, index }: Props) {
  const { dispatch } = useInterviewStore();
  const [editing, setEditing] = useState(false);
  const [draftQ, setDraftQ] = useState(question.question);
  const [draftA, setDraftA] = useState(question.answer);

  const handleSave = () => {
    if (!draftQ.trim() || !draftA.trim()) return;
    dispatch({
      type: 'UPDATE_QUESTION',
      interviewId,
      questionId: question.id,
      question: draftQ.trim(),
      answer: draftA.trim(),
    });
    toast.success('Сохранено');
    setEditing(false);
  };

  const handleCancel = () => {
    setDraftQ(question.question);
    setDraftA(question.answer);
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirm('Удалить вопрос?')) return;
    dispatch({ type: 'DELETE_QUESTION', interviewId, questionId: question.id });
    toast.success('Вопрос удалён');
  };

  return (
    <div className="q-card">
      <span className="q-card-index">{index}</span>

      <div className="q-card-body">
        {editing ? (
          <>
            <div className="q-field">
              <Textarea
                label="Вопрос"
                size="sm"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="q-field">
              <Textarea
                label="Ответ"
                size="sm"
                value={draftA}
                onChange={(e) => setDraftA(e.target.value)}
              />
            </div>
            <div className="q-edit-actions">
              <Button variant="ghost" size="sm" onClick={handleCancel}>Отмена</Button>
              <Button size="sm" onClick={handleSave}>Сохранить</Button>
            </div>
          </>
        ) : (
          <>
            <div className="q-field">
              <span className="q-label">Вопрос</span>
              <p className="q-text">{question.question}</p>
            </div>
            <div className="q-field">
              <span className="q-label">Ответ</span>
              <p className="q-text q-answer">{question.answer}</p>
            </div>
          </>
        )}
      </div>

      {!editing && (
        <div className="q-card-actions">
          <button className="icon-btn" title="Редактировать" onClick={() => setEditing(true)}><Icon name="edit-01" size={12} /></button>
          <button className="icon-btn danger" title="Удалить" onClick={handleDelete}><Icon name="close" size={12} /></button>
        </div>
      )}
    </div>
  );
}
