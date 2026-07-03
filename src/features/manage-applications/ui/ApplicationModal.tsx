'use client';

import { useState } from 'react';
import { Button, Modal, Input, Textarea, Select, toast } from 'mikro-ui';
import { useApplicationStore } from '@/app/providers/ApplicationStoreProvider';
import { STATUS_OPTIONS, type Application, type ApplicationStatus } from '@/entities/application';

interface Props {
  initial?: Application;
  onClose: () => void;
}

const EMPTY = {
  company: '',
  position: '',
  url: '',
  status: 'planning' as ApplicationStatus,
  note: '',
};

export function ApplicationModal({ initial, onClose }: Props) {
  const { dispatch } = useApplicationStore();
  const isEdit = !!initial;

  const [company, setCompany] = useState(initial?.company ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [status, setStatus] = useState<ApplicationStatus>(initial?.status ?? 'planning');
  const [note, setNote] = useState(initial?.note ?? '');

  const handleSave = () => {
    if (!company.trim() || !position.trim()) return;
    if (isEdit && initial) {
      dispatch({
        type: 'UPDATE_APPLICATION',
        id: initial.id,
        company: company.trim(),
        position: position.trim(),
        url: url.trim() || undefined,
        status,
        note: note.trim() || undefined,
      });
      toast.success('Обновлено');
    } else {
      dispatch({
        type: 'ADD_APPLICATION',
        company: company.trim(),
        position: position.trim(),
        url: url.trim() || undefined,
        status,
        note: note.trim() || undefined,
      });
      toast.success('Отклик добавлен');
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Редактировать отклик' : 'Новый отклик'}
      size="sm"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          label="Компания"
          placeholder="Яндекс"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          autoFocus
        />
        <Input
          label="Должность"
          placeholder="Senior Frontend Developer"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        <Input
          label="Ссылка на вакансию"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>Статус</div>
          <Select
            value={status}
            onChange={(val) => setStatus(val as ApplicationStatus)}
            options={STATUS_OPTIONS}
          />
        </div>
        <Textarea
          label="Заметка"
          placeholder="Позвонили на следующий день, назначили технический этап..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          size="sm"
        />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
        <Button size="sm" onClick={handleSave} disabled={!company.trim() || !position.trim()}>
          {isEdit ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </Modal>
  );
}
