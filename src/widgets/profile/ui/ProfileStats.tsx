'use client';

import { useState, useEffect, useMemo } from 'react';
import { useProblemStore } from '@/app/providers/ProblemStoreProvider';
import { useInterviewStore } from '@/app/providers/InterviewStoreProvider';
import { useWorkspaceStore } from '@/app/providers/WorkspaceStoreProvider';
import { readPackProgress } from '@/shared/lib/storage';
import { builtinPacks } from '@/data/packs/builtin';

export function ProfileStats() {
  const { state: probState } = useProblemStore();
  const { state: ivState }   = useInterviewStore();
  const { state: wsState }   = useWorkspaceStore();

  // Start at 0/0 so SSR and first client render match, then hydrate from localStorage
  const [frontendProgress, setFrontendProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!wsState.hydrated) return;
    const pack = builtinPacks.find((p) => p.id === 'frontend');
    if (!pack) return;
    const topicIds = pack.sections.flatMap((s) => s.topics.map((t) => t.id));
    const { done, total } = readPackProgress(pack.id, wsState.currentId, topicIds, pack.defaultDoneIds);
    setFrontendProgress({ done, total });
  }, [wsState.hydrated, wsState.currentId]);

  const solvedProblems = useMemo(
    () => probState.problems.filter((p) => p.status === 'solved').length,
    [probState.problems],
  );

  const totalQuestions = useMemo(
    () => ivState.interviews.reduce((sum, iv) => sum + iv.questions.length, 0),
    [ivState.interviews],
  );

  return (
    <div className="summary" style={{ marginBottom: 28 }}>
      <div className="metric">
        <div className="metric-label">Тем пройдено</div>
        <div className="metric-val">
          {frontendProgress.done}
          <span style={{ fontSize: 14, fontWeight: 400, color: '#999' }}>
            /{frontendProgress.total}
          </span>
        </div>
      </div>
      <div className="metric">
        <div className="metric-label">Задач решено</div>
        <div className="metric-val">{solvedProblems}</div>
      </div>
      <div className="metric">
        <div className="metric-label">Вопросов</div>
        <div className="metric-val">{totalQuestions}</div>
      </div>
      <div className="metric">
        <div className="metric-label">Откликов</div>
        <div className="metric-val" id="profile-applications-count">—</div>
      </div>
    </div>
  );
}
