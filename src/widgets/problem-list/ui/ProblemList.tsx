'use client';

import { useState } from 'react';
import { Button } from 'mikro-ui';
import { useProblemStore, PATTERNS, type Difficulty, type ProblemStatus, type Pattern } from '@/entities/problem';
import { ProblemModal } from '@/features/manage-problems';
import { ProblemCard } from './ProblemCard';

type DiffFilter = Difficulty | 'all';
type StatusFilter = ProblemStatus | 'all';

const DIFF_OPTIONS: { value: DiffFilter; label: string }[] = [
  { value: 'all',    label: 'Все' },
  { value: 'easy',   label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',    label: 'Все' },
  { value: 'todo',   label: 'Не решал' },
  { value: 'hint',   label: 'С подсказкой' },
  { value: 'solved', label: 'Решил' },
];

const DIFF_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export function ProblemList() {
  const { state } = useProblemStore();
  const [creating, setCreating] = useState(false);
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [patternFilter, setPatternFilter] = useState<Pattern | 'all'>('all');

  if (!state.hydrated) {
    return (
      <div>
        <div className="page-toolbar">
          <div className="skeleton" style={{ width: 160, height: 26, borderRadius: 3 }} />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="problem-card">
            <div className="skeleton" style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0 }} />
            <div className="problem-body">
              <div className="skeleton" style={{ width: `${45 + i * 12}%`, height: 14, marginBottom: 6, borderRadius: 3 }} />
              <div className="skeleton" style={{ width: 140, height: 11, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const total   = state.problems.length;
  const solved  = state.problems.filter((p) => p.status === 'solved').length;
  const hint    = state.problems.filter((p) => p.status === 'hint').length;
  const todo    = state.problems.filter((p) => p.status === 'todo').length;
  const byDiff  = (d: Difficulty) => state.problems.filter((p) => p.difficulty === d);

  const filtered = [...state.problems]
    .filter((p) => diffFilter === 'all' || p.difficulty === diffFilter)
    .filter((p) => statusFilter === 'all' || p.status === statusFilter)
    .filter((p) => patternFilter === 'all' || p.patterns.includes(patternFilter))
    .sort((a, b) => {
      const statusOrd = { todo: 0, hint: 1, solved: 2 };
      if (statusOrd[a.status] !== statusOrd[b.status]) return statusOrd[a.status] - statusOrd[b.status];
      return DIFF_ORDER.indexOf(b.difficulty) - DIFF_ORDER.indexOf(a.difficulty);
    });

  const usedPatterns = [...new Set(state.problems.flatMap((p) => p.patterns))];

  return (
    <div>
      <div className="page-toolbar">
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
          + Добавить задачу
        </Button>
      </div>

      {total > 0 && (
        <>
          <div className="summary" style={{ marginBottom: 16 }}>
            {DIFF_ORDER.map((d) => {
              const group = byDiff(d);
              const s = group.filter((p) => p.status === 'solved').length;
              return (
                <div key={d} className="metric">
                  <div className="metric-label">{d}</div>
                  <div className="metric-val">{s}<span style={{ fontSize: 14, fontWeight: 400, color: '#999' }}>/{group.length}</span></div>
                </div>
              );
            })}
            <div className="metric">
              <div className="metric-label">Всего</div>
              <div className="metric-val">{solved}<span style={{ fontSize: 14, fontWeight: 400, color: '#999' }}>/{total}</span></div>
            </div>
          </div>

          <div className="prob-filters">
            <div className="prob-filter-group">
              {DIFF_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={`prob-filter-btn${diffFilter === value ? ' active' : ''}`}
                  onClick={() => setDiffFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="prob-filter-group">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={`prob-filter-btn${statusFilter === value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {usedPatterns.length > 0 && (
              <div className="prob-filter-group" style={{ flexWrap: 'wrap' }}>
                <button
                  className={`prob-filter-btn${patternFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setPatternFilter('all')}
                >
                  Все паттерны
                </button>
                {usedPatterns.map((p) => (
                  <button
                    key={p}
                    className={`prob-filter-btn${patternFilter === p ? ' active' : ''}`}
                    onClick={() => setPatternFilter(p)}
                  >
                    {PATTERNS.find((x) => x.value === p)?.label ?? p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          {total === 0
            ? (<><p style={{ marginBottom: 4 }}>Задач пока нет</p><p>Добавь первую задачу с LeetCode или другой платформы</p></>)
            : <p>Нет задач с такими фильтрами</p>
          }
        </div>
      ) : (
        <div className="problem-list">
          {filtered.map((p) => (
            <ProblemCard key={p.id} problem={p} />
          ))}
        </div>
      )}

      {creating && <ProblemModal onClose={() => setCreating(false)} />}
    </div>
  );
}
