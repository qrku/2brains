'use client';

import { useState } from 'react';
import { Button, Modal, Input, toast } from 'mikro-ui';
import { useProfileStore, AVATAR_OPTIONS, type Profile } from '@/entities/profile';

interface Props {
  onClose: () => void;
}

export function EditProfileModal({ onClose }: Props) {
  const { state, dispatch } = useProfileStore();
  const p = state.profile;

  const [avatar,   setAvatar]   = useState(p.avatar);
  const [nickname, setNickname] = useState(p.nickname);

  const handleSave = () => {
    const updated: Profile = { avatar, nickname: nickname.trim() };
    dispatch({ type: 'UPDATE', profile: updated });
    toast.success('Профиль обновлён');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Редактировать профиль" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div>
          <div className="modal-field-label" style={{ marginBottom: 8 }}>Аватар</div>
          <div className="avatar-grid">
            {AVATAR_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`avatar-opt${avatar === emoji ? ' active' : ''}`}
                onClick={() => setAvatar(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Никнейм"
          placeholder="Артём"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          autoFocus
        />
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 20 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
        <Button size="sm" onClick={handleSave}>Сохранить</Button>
      </div>
    </Modal>
  );
}
