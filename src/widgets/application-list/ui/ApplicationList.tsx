'use client';

import { useState } from 'react';
import { Button } from 'mikro-ui';
import { useApplicationStore, type ApplicationStatus } from '@/entities/application';
import { ApplicationModal } from '@/features/manage-applications';
import { ApplicationCard } from './ApplicationCard';

const FILTER_OPTIONS: { value: ApplicationStatus | 'all'; label: string }[] = [
  { value: 'all',      label: 'Все' },
  { value: 'planning', label: 'Планирую' },
  { value: 'sent',     label: 'Отправлено' },
  { value: 'waiting',  label: 'Жду ответа' },
  { value: 'invited',  label: 'Приглашение' },
  { value: 'offer',    label: 'Оффер' },
  { value: 'rejected', label: 'Отказ' },
];

const STATUS_ORDER: ApplicationStatus[] = ['invited', 'offer', 'waiting', 'sent', 'planning', 'rejected'];

export function ApplicationList() {
  const { state } = useApplicationStore();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');

  if (!state.hydrated) {
    return (
      <div>
        <div className="page-toolbar">
          <div className="skeleton" style={{ width: 160, height: 26, borderRadius: 3 }} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="app-card">
            <div className="app-card-main">
              <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 6, borderRadius: 3 }} />
              <div className="skeleton" style={{ width: 200, height: 12, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const filtered = [...state.applications]
    .filter((a) => filter === 'all' || a.status === filter)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const counts = state.applications.reduce<Partial<Record<ApplicationStatus, number>>>(
    (acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }),
    {}
  );

  return (
    <div>
      <div className="page-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          + Добавить отклик
        </Button>
      </div>

      {state.applications.length > 0 && (
        <div className="app-filters">
          {FILTER_OPTIONS.map(({ value, label }) => {
            const count = value === 'all' ? state.applications.length : (counts[value as ApplicationStatus] ?? 0);
            if (count === 0 && value !== 'all') return null;
            return (
              <button
                key={value}
                className={`app-filter-btn${filter === value ? ' active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {label}
                {count > 0 && <span className="app-filter-count">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          {state.applications.length === 0
            ? (<><p style={{ marginBottom: 4 }}>Откликов пока нет</p><p>Добавь первое собеседование или вакансию, куда планируешь откликнуться</p></>)
            : (<p>Нет откликов с таким статусом</p>)
          }
        </div>
      ) : (
        <div className="app-list">
          {filtered.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </div>
      )}

      {creating && <ApplicationModal onClose={() => setCreating(false)} />}
    </div>
  );
}
