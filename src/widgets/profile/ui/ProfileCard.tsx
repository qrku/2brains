'use client';

import { useState } from 'react';
import { Button } from 'mikro-ui';
import { useProfileStore } from '@/app/providers/ProfileStoreProvider';
import { EditProfileModal } from '@/features/edit-profile';
import { LEVEL_LABELS } from '@/entities/profile';

export function ProfileCard() {
  const { state } = useProfileStore();
  const [editing, setEditing] = useState(false);
  const { profile } = state;

  const isEmpty = !profile.nickname && !profile.role && !profile.stack.length;

  return (
    <>
      <div className="profile-card">
        <div className="profile-avatar">{profile.avatar || '🦊'}</div>

        <div className="profile-info">
          {isEmpty ? (
            <>
              <div className="profile-name profile-name--empty">Заполни профиль</div>
              <div className="profile-role">Расскажи о своём стеке и уровне</div>
            </>
          ) : (
            <>
              <div className="profile-name">{profile.nickname || 'Без имени'}</div>
              <div className="profile-role">
                {profile.level && (
                  <span className="level-badge">{LEVEL_LABELS[profile.level]}</span>
                )}
                {profile.role}
              </div>
              {profile.stack.length > 0 && (
                <div className="profile-stack">
                  {profile.stack.map((tag) => (
                    <span key={tag} className="profile-stack-tag">{tag}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="profile-actions">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Редактировать
          </Button>
        </div>
      </div>

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </>
  );
}
