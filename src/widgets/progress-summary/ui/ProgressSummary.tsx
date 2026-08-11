'use client';

import { usePrepStore, useStats } from '@/entities/section';
import { getLevel } from '@/shared/config/levels';
import { ProgressSummarySkeleton } from './ProgressSummarySkeleton';

export function ProgressSummary() {
  const { state } = usePrepStore();
  const { tot, cov, pct } = useStats();

  if (!state.hydrated) return <ProgressSummarySkeleton />;

  return (
    <>
      <div className="summary">
        <div className="metric">
          <div className="metric-label">Покрыто</div>
          <div className="metric-val">{cov}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Осталось</div>
          <div className="metric-val">{tot - cov}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Прогресс</div>
          <div className="metric-val">{pct}%</div>
        </div>
        <div className="metric">
          <div className="metric-label">Уровень</div>
          <div className="metric-val" style={{ fontSize: 15, paddingTop: 5 }}>
            {getLevel(pct)}
          </div>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-label">
          <strong>Общий прогресс</strong>
          <span>{cov} из {tot} тем</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </>
  );
}
