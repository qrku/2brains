'use client';

import { useState } from 'react';
import { Button } from 'mikro-ui';
import { useProfileStore } from '@/app/providers/ProfileStoreProvider';
import { EditProfileModal } from '@/features/edit-profile';

export function ProfileCard() {
  const { state } = useProfileStore();
  const [editing, setEditing] = useState(false);
  const { profile } = state;

  return (
    <>
      <div className="profile-card">
        <div className="profile-avatar">{profile.avatar || '🦊'}</div>

        <div className="profile-info">
          {profile.nickname ? (
            <div className="profile-name">{profile.nickname}</div>
          ) : (
            <div className="profile-name profile-name--empty">Без имени</div>
          )}
          <div className="profile-hint">
            {profile.nickname ? 'Твой профиль' : 'Выбери аватар и укажи никнейм'}
          </div>
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
