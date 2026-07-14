'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUserPacksStore } from '@/app/providers/UserPacksStoreProvider';
import { useWorkspaceStore } from '@/app/providers/WorkspaceStoreProvider';
import { readPackProgress } from '@/shared/lib/storage';
import { builtinPacks } from '@/data/packs/builtin';
import { Icon } from '@/shared/ui/Icon';

interface PackProgress {
  id: string;
  title: string;
  done: number;
  total: number;
  pct: number;
}

export function ActivePacks() {
  const { state: userPacksState } = useUserPacksStore();
  const { state: wsState } = useWorkspaceStore();
  const [activePacks, setActivePacks] = useState<PackProgress[]>([]);

  useEffect(() => {
    if (!wsState.hydrated) return;
    const results: PackProgress[] = [];

    // Built-in packs
    for (const pack of builtinPacks) {
      const topicIds = pack.sections.flatMap((s) => s.topics.map((t) => t.id));
      const prog = readPackProgress(pack.id, wsState.currentId, topicIds, pack.defaultDoneIds);
      if (prog.done > 0) {
        results.push({ id: pack.id, title: pack.title, ...prog });
      }
    }

    // User packs
    if (userPacksState.hydrated) {
      for (const pack of userPacksState.packs) {
        const prog = readPackProgress(pack.id, wsState.currentId, [], []);
        if (prog.done > 0) {
          results.push({ id: pack.id, title: pack.title, ...prog });
        }
      }
    }

    setActivePacks(results.sort((a, b) => b.pct - a.pct));
  }, [userPacksState.hydrated, userPacksState.packs, wsState.hydrated, wsState.currentId]);

  return (
    <div className="active-packs">
      <div className="section-header-row">
        <span className="section-label">В процессе</span>
        <Link href="/knowledge" className="btn-link ghost">Все <Icon name="arrow-forward" size={11} /></Link>
      </div>

      {activePacks.length === 0 ? (
        <div style={{ padding: '20px 0', color: '#bbb', fontSize: 13 }}>
          Открой пак чтобы начать подготовку
        </div>
      ) : (
        <div className="active-pack-list">
          {activePacks.map((p) => (
            <Link key={p.id} href={`/knowledge/${p.id}`} className="active-pack-row">
              <span className="active-pack-name">{p.title}</span>
              <div className="active-pack-bar-wrap">
                <div className="active-pack-bar">
                  <div className="active-pack-bar-fill" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
              <span className="active-pack-pct">{p.pct}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
