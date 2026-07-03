'use client';

import { useState } from 'react';
import { Textarea, Button, toast } from 'mikro-ui';
import { useExperienceStore } from '@/app/providers/ExperienceStoreProvider';

interface Props {
  experienceId: string;
}

export function AddPointForm({ experienceId }: Props) {
  const { dispatch } = useExperienceStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (!text.trim()) return;
    dispatch({ type: 'ADD_POINT', experienceId, text: text.trim() });
    toast.success('Пункт добавлен');
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="add-q-trigger" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
        + Добавить пункт
      </button>
    );
  }

  return (
    <div className="add-q-form" style={{ marginTop: 12 }}>
      <Textarea
        label="Пункт"
        size="sm"
        placeholder="Реализовал компонент поиска с автодополнением..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setText(''); }}>
          Отмена
        </Button>
        <Button size="sm" onClick={handleAdd}>Добавить</Button>
      </div>
    </div>
  );
}
