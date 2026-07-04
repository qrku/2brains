'use client';

import { useState } from 'react';
import { Textarea, Button, toast } from 'mikro-ui';
import { useExperienceStore } from '@/app/providers/ExperienceStoreProvider';
import type { Point } from '@/entities/experience';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  experienceId: string;
  point: Point;
}

export function PointItem({ experienceId, point }: Props) {
  const { dispatch } = useExperienceStore();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(point.text);

  const handleSave = () => {
    if (!draftText.trim()) return;
    dispatch({ type: 'UPDATE_POINT', experienceId, pointId: point.id, text: draftText.trim() });
    toast.success('Сохранено');
    setEditing(false);
  };

  const handleCancel = () => { setDraftText(point.text); setEditing(false); };

  return (
    <div className="point-item">
      <span className="point-dot" />
      <div className="point-body">
        {editing ? (
          <>
            <Textarea
              size="sm"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              autoFocus
            />
            <div className="point-edit-actions">
              <Button variant="ghost" size="sm" onClick={handleCancel}>Отмена</Button>
              <Button size="sm" onClick={handleSave}>Сохранить</Button>
            </div>
          </>
        ) : (
          <p className="point-text">{point.text}</p>
        )}
      </div>
      {!editing && (
        <div className="point-actions">
          <button
            className="icon-btn"
            title="Редактировать"
            onClick={() => { setDraftText(point.text); setEditing(true); }}
          >
            <Icon name="edit-01" size={12} />
          </button>
          <button
            className="icon-btn danger"
            title="Удалить"
            onClick={() => dispatch({ type: 'DELETE_POINT', experienceId, pointId: point.id })}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
