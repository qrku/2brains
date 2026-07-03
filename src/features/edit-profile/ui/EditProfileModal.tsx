'use client';

import { useState, type KeyboardEvent } from 'react';
import { Button, Modal, Input, Select, toast } from 'mikro-ui';
import { useProfileStore } from '@/app/providers/ProfileStoreProvider';
import {
  AVATAR_OPTIONS,
  STACK_SUGGESTIONS,
  LEVEL_LABELS,
  type Profile,
  type Level,
} from '@/entities/profile';

const LEVEL_OPTIONS = [
  { value: '', label: 'Уровень не указан' },
  ...Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label })),
];

interface Props {
  onClose: () => void;
}

export function EditProfileModal({ onClose }: Props) {
  const { state, dispatch } = useProfileStore();
  const p = state.profile;

  const [avatar,   setAvatar]   = useState(p.avatar);
  const [nickname, setNickname] = useState(p.nickname);
  const [role,     setRole]     = useState(p.role);
  const [level,    setLevel]    = useState<Level>(p.level);
  const [stack,    setStack]    = useState<string[]>(p.stack);
  const [tagInput, setTagInput] = useState('');

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !stack.includes(t)) setStack((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => setStack((prev) => prev.filter((t) => t !== tag));

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
    if (e.key === 'Backspace' && !tagInput && stack.length) setStack((prev) => prev.slice(0, -1));
  };

  const handleSave = () => {
    const updated: Profile = { avatar, nickname: nickname.trim(), role: role.trim(), level, stack };
    dispatch({ type: 'UPDATE', profile: updated });
    toast.success('Профиль обновлён');
    onClose();
  };

  const unusedSuggestions = STACK_SUGGESTIONS.filter((s) => !stack.includes(s));

  return (
    <Modal open onClose={onClose} title="Редактировать профиль" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Avatar */}
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
          autoFocus
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <Input
            label="Должность"
            placeholder="Frontend Developer"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ flex: 1 }}
          />
          <div style={{ flex: 1 }}>
            <div className="modal-field-label" style={{ marginBottom: 4 }}>Уровень</div>
            <Select
              value={level}
              onChange={(val) => setLevel(val as Level)}
              options={LEVEL_OPTIONS}
            />
          </div>
        </div>

        {/* Stack tags */}
        <div>
          <div className="modal-field-label" style={{ marginBottom: 8 }}>Стек</div>
          <div className="stack-input-wrap">
            {stack.map((tag) => (
              <span key={tag} className="stack-chip">
                {tag}
                <button className="stack-chip-remove" onClick={() => removeTag(tag)}>✕</button>
              </span>
            ))}
            <input
              className="stack-text-input"
              placeholder="Добавить технологию..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKey}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            />
          </div>
          {unusedSuggestions.length > 0 && (
            <div className="stack-suggestions">
              {unusedSuggestions.slice(0, 10).map((s) => (
                <button key={s} className="stack-suggestion" onClick={() => addTag(s)}>
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 20 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
        <Button size="sm" onClick={handleSave}>Сохранить</Button>
      </div>
    </Modal>
  );
}
