'use client';

import { useState } from 'react';
import { Textarea, Button, toast } from 'mikro-ui';
import { useInterviewStore } from '@/entities/interview';

interface Props {
  interviewId: string;
}

export function AddQuestionForm({ interviewId }: Props) {
  const { dispatch } = useInterviewStore();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleAdd = () => {
    if (!question.trim() || !answer.trim()) return;
    dispatch({
      type: 'ADD_QUESTION',
      interviewId,
      question: question.trim(),
      answer: answer.trim(),
    });
    toast.success('Вопрос добавлен');
    setQuestion('');
    setAnswer('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="add-q-trigger" onClick={() => setOpen(true)}>
        + Добавить вопрос
      </button>
    );
  }

  return (
    <div className="add-q-form">
      <Textarea
        label="Вопрос"
        size="sm"
        placeholder="Что такое замыкание в JavaScript?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        autoFocus
      />
      <Textarea
        label="Ответ"
        size="sm"
        placeholder="Замыкание — это функция, которая..."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setOpen(false); setQuestion(''); setAnswer(''); }}
        >
          Отмена
        </Button>
        <Button size="sm" onClick={handleAdd}>Добавить</Button>
      </div>
    </div>
  );
}
