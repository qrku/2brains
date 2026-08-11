'use client';

import { useState } from 'react';
import { toast } from 'mikro-ui';
import { useProblemStore, PATTERN_MAP, STATUS_LABELS, type Problem } from '@/entities/problem';
import { ProblemModal } from '@/features/manage-problems';
import { Icon } from '@/shared/ui/Icon';
import { safeUrl } from '@/shared/lib/safeUrl';

const STATUS_ICONS: Record<string, string> = {
  todo:   '○',
  hint:   '◑',
  solved: '●',
};

const DIFF_SHORT: Record<string, string> = {
  easy:   'E',
  medium: 'M',
  hard:   'H',
};

interface Props {
  problem: Problem;
}

export function ProblemCard({ problem }: Props) {
  const { dispatch } = useProblemStore();
  const [editing, setEditing] = useState(false);

  const handleCycle = () => {
    dispatch({ type: 'CYCLE_STATUS', id: problem.id });
    const next = { todo: 'hint', hint: 'solved', solved: 'todo' }[problem.status] as string;
    toast.success(STATUS_LABELS[next as keyof typeof STATUS_LABELS]);
  };

  const handleDelete = () => {
    if (!confirm(`Удалить «${problem.title}»?`)) return;
    dispatch({ type: 'DELETE_PROBLEM', id: problem.id });
  };

  return (
    <>
      <div className="problem-card">
        <button
          className={`problem-status-btn prob-status--${problem.status}`}
          onClick={handleCycle}
          title={`${STATUS_LABELS[problem.status]} — нажми чтобы сменить`}
        >
          {STATUS_ICONS[problem.status]}
        </button>

        <div className="problem-body">
          <div className="problem-top">
            {problem.url ? (
              <a
                href={safeUrl(problem.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="problem-title problem-link"
              >
                {problem.title}
              </a>
            ) : (
              <span className="problem-title">{problem.title}</span>
            )}
            <span className={`diff-badge diff-${problem.difficulty}`}>
              {DIFF_SHORT[problem.difficulty]}
            </span>
          </div>

          {problem.patterns.length > 0 && (
            <div className="problem-patterns">
              {problem.patterns.map((p) => (
                <span key={p} className="pattern-tag">{PATTERN_MAP[p]}</span>
              ))}
            </div>
          )}

          {problem.note && <p className="problem-note">{problem.note}</p>}
        </div>

        <div className="problem-actions">
          <button className="icon-btn" title="Редактировать" onClick={() => setEditing(true)}><Icon name="edit-01" size={12} /></button>
          <button className="icon-btn danger" title="Удалить" onClick={handleDelete}><Icon name="close" size={12} /></button>
        </div>
      </div>

      {editing && <ProblemModal initial={problem} onClose={() => setEditing(false)} />}
    </>
  );
}
