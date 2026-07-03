'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUserPacksStore } from '@/app/providers/UserPacksStoreProvider';
import { readPackProgress } from '@/shared/lib/storage';
import type { BuiltinPackDef, UserPack } from '@/entities/pack';

interface BuiltinCardProps {
  pack: BuiltinPackDef;
}

export function BuiltinPackCard({ pack }: BuiltinCardProps) {
  const topicIds = pack.sections.flatMap((s) => s.topics.map((t) => t.id));
  const [progress, setProgress] = useState({ done: 0, total: topicIds.length, pct: 0 });

  useEffect(() => {
    setProgress(readPackProgress(pack.id, topicIds, pack.defaultDoneIds));
  }, [pack.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pack-card">
      <div className="pack-card-body">
        <div className="pack-title">{pack.title}</div>
        <div className="pack-desc">{pack.description}</div>
        <div className="pack-progress-track">
          <div className="pack-progress-fill" style={{ width: `${progress.pct}%` }} />
        </div>
        <div className="pack-meta">
          {progress.pct}% · {pack.sections.length} разделов · {topicIds.length} тем
        </div>
      </div>
      <div className="pack-card-footer">
        <Link href={`/knowledge/${pack.id}`} className="btn-link">Открыть</Link>
      </div>
    </div>
  );
}

interface UserCardProps {
  pack: UserPack;
}

export function UserPackCard({ pack }: UserCardProps) {
  const { dispatch } = useUserPacksStore();
  const [progress, setProgress] = useState({ done: 0, total: 0, pct: 0 });

  useEffect(() => {
    setProgress(readPackProgress(pack.id, [], []));
  }, [pack.id]);

  const handleDelete = () => {
    if (!confirm(`Удалить пак «${pack.title}»?`)) return;
    dispatch({ type: 'DELETE_PACK', id: pack.id });
  };

  return (
    <div className="pack-card pack-card--user">
      <div className="pack-card-top-row">
        <button className="icon-btn danger" onClick={handleDelete} title="Удалить пак">✕</button>
      </div>
      <div className="pack-card-body">
        <div className="pack-title">{pack.title}</div>
        {pack.description && <div className="pack-desc">{pack.description}</div>}
        <div className="pack-progress-track">
          <div className="pack-progress-fill" style={{ width: `${progress.pct}%` }} />
        </div>
        <div className="pack-meta">
          {progress.total === 0
            ? 'Пустой пак'
            : `${progress.pct}% · ${progress.total} тем`}
        </div>
      </div>
      <div className="pack-card-footer">
        <Link href={`/knowledge/${pack.id}`} className="btn-link">Открыть</Link>
      </div>
    </div>
  );
}
