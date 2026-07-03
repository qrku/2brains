'use client';

import { useState } from 'react';
import { Button, Modal, Input, toast } from 'mikro-ui';
import { useInterviewStore } from '@/app/providers/InterviewStoreProvider';

export function CreateInterviewButton() {
  const { dispatch } = useInterviewStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleCreate = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    dispatch({ type: 'ADD_INTERVIEW', title: trimmed });
    toast.success(`Тест «${trimmed}» создан`);
    setTitle('');
    setOpen(false);
  };

  return (
    <>
      <Button size="sm" onClick={() => { setOpen(true); setTitle(''); }}>
        + Создать тест
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый тест" size="sm">
        <Input
          label="Название"
          placeholder="JavaScript — основы, CSS · июль 2026"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Отмена</Button>
          <Button size="sm" onClick={handleCreate}>Создать</Button>
        </div>
      </Modal>
    </>
  );
}
