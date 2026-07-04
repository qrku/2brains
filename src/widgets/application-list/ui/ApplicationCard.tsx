'use client';

import { useState } from 'react';
import { useApplicationStore } from '@/app/providers/ApplicationStoreProvider';
import { ApplicationModal } from '@/features/manage-applications';
import { STATUS_LABELS, type Application } from '@/entities/application';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  application: Application;
}

export function ApplicationCard({ application: app }: Props) {
  const { dispatch } = useApplicationStore();
  const [editing, setEditing] = useState(false);

  const handleDelete = () => {
    if (!confirm(`Удалить «${app.company} — ${app.position}»?`)) return;
    dispatch({ type: 'DELETE_APPLICATION', id: app.id });
  };

  return (
    <>
      <div className={`app-card app-card--${app.status}`}>
        <div className="app-card-main">
          <div className="app-card-top">
            <div className="app-card-identity">
              <span className="app-company">{app.company}</span>
              <span className="app-position">{app.position}</span>
            </div>
            <span className={`app-status app-status--${app.status}`}>
              {STATUS_LABELS[app.status]}
            </span>
          </div>

          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="app-url"
            >
              {app.url.replace(/^https?:\/\//, '')}
            </a>
          )}

          {app.note && <p className="app-note">{app.note}</p>}
        </div>

        <div className="app-card-actions">
          <button className="icon-btn" title="Редактировать" onClick={() => setEditing(true)}><Icon name="edit-01" size={12} /></button>
          <button className="icon-btn danger" title="Удалить" onClick={handleDelete}><Icon name="close" size={12} /></button>
        </div>
      </div>

      {editing && <ApplicationModal initial={app} onClose={() => setEditing(false)} />}
    </>
  );
}
