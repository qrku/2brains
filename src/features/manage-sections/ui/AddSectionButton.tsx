'use client';

import { useState } from 'react';
import { Button, Modal, Input, toast } from 'mikro-ui';
import { usePrepStore } from '@/app/providers/PrepStoreProvider';

export function AddSectionButton() {
  const { dispatch } = usePrepStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: 'ADD_SECTION', name: trimmed });
    toast.success(`Раздел «${trimmed}» добавлен`);
    setName('');
    setOpen(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); setName(''); }}>
        + Раздел
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый раздел" size="sm">
        <Input
          label="Название"
          placeholder="TypeScript, Алгоритмы..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Отмена</Button>
          <Button size="sm" onClick={handleAdd}>Добавить</Button>
        </div>
      </Modal>
    </>
  );
}
