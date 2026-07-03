'use client';

import { useState } from 'react';
import { Button, Modal, Input, Textarea, Select, toast } from 'mikro-ui';
import { useProblemStore } from '@/app/providers/ProblemStoreProvider';
import {
  PATTERNS,
  DIFFICULTY_LABELS,
  STATUS_LABELS,
  type Problem,
  type Difficulty,
  type ProblemStatus,
  type Pattern,
} from '@/entities/problem';

interface Props {
  initial?: Problem;
  onClose: () => void;
}

const DIFFICULTY_OPTIONS = (Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((v) => ({
  value: v,
  label: DIFFICULTY_LABELS[v],
}));

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as ProblemStatus[]).map((v) => ({
  value: v,
  label: STATUS_LABELS[v],
}));

export function ProblemModal({ initial, onClose }: Props) {
  const { dispatch } = useProblemStore();
  const isEdit = !!initial;

  const [title, setTitle]           = useState(initial?.title ?? '');
  const [url, setUrl]               = useState(initial?.url ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'medium');
  const [status, setStatus]         = useState<ProblemStatus>(initial?.status ?? 'todo');
  const [patterns, setPatterns]     = useState<Pattern[]>(initial?.patterns ?? []);
  const [note, setNote]             = useState(initial?.note ?? '');

  const togglePattern = (p: Pattern) =>
    setPatterns((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const handleSave = () => {
    if (!title.trim()) return;
    if (isEdit && initial) {
      dispatch({
        type: 'UPDATE_PROBLEM',
        id: initial.id,
        title: title.trim(),
        url: url.trim() || undefined,
        difficulty,
        status,
        patterns,
        note: note.trim() || undefined,
      });
      toast.success('Обновлено');
    } else {
      dispatch({
        type: 'ADD_PROBLEM',
        title: title.trim(),
        url: url.trim() || undefined,
        difficulty,
        status,
        patterns,
        note: note.trim() || undefined,
      });
      toast.success('Задача добавлена');
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Редактировать задачу' : 'Новая задача'} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          label="Название"
          placeholder="Two Sum"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <Input
          label="Ссылка (LeetCode, Codeforces...)"
          placeholder="https://leetcode.com/problems/two-sum/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="modal-field-label">Сложность</div>
            <Select
              value={difficulty}
              onChange={(val) => setDifficulty(val as Difficulty)}
              options={DIFFICULTY_OPTIONS}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="modal-field-label">Статус</div>
            <Select
              value={status}
              onChange={(val) => setStatus(val as ProblemStatus)}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        <div>
          <div className="modal-field-label" style={{ marginBottom: 8 }}>Паттерны</div>
          <div className="pattern-grid">
            {PATTERNS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`pattern-toggle${patterns.includes(value) ? ' active' : ''}`}
                onClick={() => togglePattern(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          label="Заметка"
          placeholder="Ключевая идея, что не получалось, что запомнить..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          size="sm"
        />
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
        <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
          {isEdit ? 'Сохранить' : 'Добавить'}
        </Button>
      </div>
    </Modal>
  );
}
