'use client';

import { useProfileStats } from '../model/useProfileStats';

export function ProfileStats() {
  const { workspaces, files, boards } = useProfileStats();

  return (
    <div className="profile-stats">
      <div className="metric">
        <div className="metric-label">Воркспейсов</div>
        <div className="metric-val">{workspaces}</div>
      </div>
      <div className="metric">
        <div className="metric-label">Файлов</div>
        <div className="metric-val">{files}</div>
      </div>
      <div className="metric">
        <div className="metric-label">Досок</div>
        <div className="metric-val">{boards}</div>
      </div>
    </div>
  );
}
