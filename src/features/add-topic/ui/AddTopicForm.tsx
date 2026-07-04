'use client';

import { useState } from 'react';
import { Input, Select, Button } from 'mikro-ui';
import { usePrepStore } from '@/app/providers/PrepStoreProvider';
import { Icon } from '@/shared/ui/Icon';

const PRIORITY_OPTIONS = [
  { value: '', label: 'без' },
  { value: 'high', label: 'важно' },
  { value: 'med', label: 'стоит' },
];

interface Props {
  sectionId: string;
}

export function AddTopicForm({ sectionId }: Props) {
  const { dispatch } = usePrepStore();
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({
      type: 'ADD_TOPIC',
      sectionId,
      name: trimmed,
      ...(priority ? { priority: priority as 'high' | 'med' } : {}),
    });
    setName('');
    setPriority('');
  };

  return (
    <div className="add-topic-form">
      <Input
        size="sm"
        placeholder="Добавить тему..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        style={{ flex: 1 }}
      />
      <div style={{ width: 84, flexShrink: 0 }}>
        <Select
          size="sm"
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={setPriority}
        />
      </div>
      <Button size="sm" onClick={handleAdd}><Icon name="add" size={12} /></Button>
    </div>
  );
}
