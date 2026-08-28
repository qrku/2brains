'use client';

import { useState } from 'react';
import { Button } from 'mikro-ui';
import { useProfileStore } from '@/entities/profile';
import { EditProfileModal } from '@/features/edit-profile';
import { cx } from '@/shared/lib/cx';
import styles from './ProfileCard.module.css';

export function ProfileCard() {
  const { state } = useProfileStore();
  const [editing, setEditing] = useState(false);
  const { profile } = state;

  return (
    <>
      <div className={styles['profile-card']}>
        <div className={styles['profile-avatar']}>{profile.avatar || '🦊'}</div>

        <div className={styles['profile-info']}>
          {profile.nickname ? (
            <div className={styles['profile-name']}>{profile.nickname}</div>
          ) : (
            <div className={cx(styles['profile-name'], styles['profile-name--empty'])}>
              Без имени
            </div>
          )}
          <div className={styles['profile-hint']}>
            {profile.nickname ? 'Твой профиль' : 'Выбери аватар и укажи никнейм'}
          </div>
        </div>

        <div className={styles['profile-actions']}>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Редактировать
          </Button>
        </div>
      </div>

      {editing && <EditProfileModal onClose={() => setEditing(false)} />}
    </>
  );
}
