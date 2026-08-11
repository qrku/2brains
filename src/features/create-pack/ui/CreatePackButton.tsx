'use client';

import { useState } from 'react';
import { Button, Modal, Input, Textarea, toast } from 'mikro-ui';
import { useUserPacksStore } from '@/entities/pack';

export function CreatePackButton() {
  const { dispatch } = useUserPacksStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const close = () => { setOpen(false); setTitle(''); setDescription(''); };

  const handleCreate = () => {
    if (!title.trim()) return;
    dispatch({ type: 'ADD_PACK', title: title.trim(), description: description.trim() });
    toast.success('Пак создан');
    close();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + Создать пак
      </Button>
      <Modal open={open} onClose={close} title="Новый пак" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Название"
            placeholder="Мой пак"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <Textarea
            label="Описание (необязательно)"
            placeholder="Что войдёт в этот пак..."
            size="sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
