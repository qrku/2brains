'use client';

import { useState } from 'react';
import { Button, Modal, Input, toast } from 'mikro-ui';
import { useExperienceStore } from '@/app/providers/ExperienceStoreProvider';

export function CreateExperienceButton() {
  const { dispatch } = useExperienceStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('');

  const close = () => { setOpen(false); setTitle(''); setPeriod(''); };

  const handleCreate = () => {
    if (!title.trim()) return;
    dispatch({ type: 'ADD_EXPERIENCE', title: title.trim(), period: period.trim() || undefined });
    toast.success('Проект добавлен');
    close();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + Добавить проект
      </Button>
      <Modal open={open} onClose={close} title="Новый проект" size="sm">
        <Input
          label="Название"
          placeholder="Яндекс — команда поиска"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
        <div style={{ marginTop: 12 }}>
          <Input
            label="Период (необязательно)"
            placeholder="2024–2025"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={close}>Отмена</Button>
          <Button size="sm" onClick={handleCreate} disabled={!title.trim()}>Создать</Button>
        </div>
      </Modal>
    </>
  );
}
