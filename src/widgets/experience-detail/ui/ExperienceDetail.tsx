'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Input, toast } from 'mikro-ui';
import { useExperienceStore } from '@/entities/experience';
import { PointItem, AddPointForm } from '@/features/manage-points';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  id: string;
}

export function ExperienceDetail({ id }: Props) {
  const { state, dispatch } = useExperienceStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState('');

  if (!state.hydrated) {
    return (
      <div className="container">
        <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 3, marginBottom: 28 }} />
        <div className="skeleton" style={{ width: 260, height: 22, borderRadius: 3, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 3, marginBottom: 32 }} />
        <div className="points-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="point-item">
              <span className="point-dot" />
              <div className="skeleton" style={{ width: `${55 + i * 10}%`, height: 13, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const exp = state.experiences.find((e) => e.id === id);

  if (!exp) {
    return (
      <div className="container">
        <Link href="/experience" className="btn-link ghost" style={{ marginBottom: 28, display: 'inline-flex' }}>
          <Icon name="arrow-back" size={12} /> Назад
        </Link>
        <div className="empty-state" style={{ marginTop: 64 }}>Проект не найден</div>
      </div>
    );
  }

  const saveTitle = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== exp.title) {
      dispatch({ type: 'UPDATE_EXPERIENCE', id, title: trimmed });
      toast.success('Название обновлено');
    }
    setEditingTitle(false);
  };

  const savePeriod = () => {
    dispatch({ type: 'UPDATE_EXPERIENCE', id, period: draftPeriod.trim() || null });
    toast.success('Период обновлён');
    setEditingPeriod(false);
  };

  return (
    <div className="container">
      <Link href="/experience" className="btn-link ghost" style={{ marginBottom: 24, display: 'inline-flex' }}>
        <Icon name="arrow-back" size={12} /> Все проекты
      </Link>

      <div className="detail-header">
        {editingTitle ? (
          <div className="title-edit-row">
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              autoFocus
              style={{ fontSize: 18 }}
            />
            <Button size="sm" onClick={saveTitle}>Сохранить</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>Отмена</Button>
          </div>
        ) : (
          <div className="title-view-row">
            <h1 className="detail-title">{exp.title}</h1>
            <button
              className="icon-btn"
              title="Переименовать"
              onClick={() => { setDraftTitle(exp.title); setEditingTitle(true); }}
            >
              <Icon name="edit-01" size={12} />
            </button>
          </div>
        )}

        {editingPeriod ? (
          <div className="period-edit-row">
            <Input
              value={draftPeriod}
              placeholder="2024–2025"
              onChange={(e) => setDraftPeriod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') savePeriod();
                if (e.key === 'Escape') setEditingPeriod(false);
              }}
              autoFocus
              size="sm"
              style={{ width: 160 }}
            />
            <Button size="sm" onClick={savePeriod}>OK</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingPeriod(false)}><Icon name="close" size={11} /></Button>
          </div>
        ) : (
          <div className="period-view-row">
            <span className="detail-period">
              {exp.period ?? <span style={{ color: '#ccc' }}>период не указан</span>}
            </span>
            <button
              className="icon-btn"
              title="Изменить период"
              onClick={() => { setDraftPeriod(exp.period ?? ''); setEditingPeriod(true); }}
            >
              <Icon name="edit-01" size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="points-list">
        {exp.points.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 24 }}>
            Добавь первый пункт — что делал, какой стек, что вынес
          </div>
        ) : (
          exp.points.map((point) => (
            <PointItem key={point.id} experienceId={id} point={point} />
          ))
        )}
      </div>

      <AddPointForm experienceId={id} />
    </div>
  );
}
