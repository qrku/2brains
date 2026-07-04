'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useUserPacksStore } from '@/app/providers/UserPacksStoreProvider';
import { CreatePackButton } from '@/features/create-pack';
import { builtinPacks } from '@/data/packs/builtin';
import { readPackProgress } from '@/shared/lib/storage';
import { CATEGORY_LABELS } from '@/entities/pack';
import type { PackCategory, BuiltinPackDef } from '@/entities/pack';
import { Icon } from '@/shared/ui/Icon';

type SortKey = 'default' | 'progress' | 'az';

interface PackProgress { done: number; total: number; pct: number }

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default',  label: 'По умолчанию' },
  { value: 'progress', label: 'По прогрессу'  },
  { value: 'az',       label: 'По алфавиту'   },
];

function MarketCard({ pack, progress }: { pack: BuiltinPackDef; progress: PackProgress }) {
  return (
    <Link href={`/knowledge/${pack.id}`} className="market-card">
      <div className="market-card-cat">{CATEGORY_LABELS[pack.category]}</div>
      <div className="market-card-title">{pack.title}</div>
      <div className="market-card-desc">{pack.description}</div>
      <div className="market-card-tags">
        {pack.tags.map((tag) => (
          <span key={tag} className="market-card-tag">{tag}</span>
        ))}
      </div>
      <div className="market-card-bar-wrap">
        <div className="market-card-bar">
          <div className="market-card-bar-fill" style={{ width: `${progress.pct}%` }} />
        </div>
      </div>
      <div className="market-card-footer">
        <span className="market-card-stats">
          {progress.pct > 0
            ? `${progress.pct}% пройдено`
            : `${pack.sections.length} разделов · ${progress.total} тем`}
        </span>
        <span className="market-card-open">Открыть <Icon name="arrow-forward" size={11} /></span>
      </div>
    </Link>
  );
}

export function KnowledgeMarketplace() {
  const { state: userState } = useUserPacksStore();
  const [activeCategory, setActiveCategory] = useState<PackCategory | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('default');
  const [progressMap, setProgressMap] = useState<Record<string, PackProgress>>({});

  useEffect(() => {
    const map: Record<string, PackProgress> = {};
    for (const pack of builtinPacks) {
      const topicIds = pack.sections.flatMap((s) => s.topics.map((t) => t.id));
      map[pack.id] = readPackProgress(pack.id, topicIds, pack.defaultDoneIds);
    }
    setProgressMap(map);
  }, []);

  // derive available categories from current packs
  const availableCats = useMemo(() => {
    const seen = new Set(builtinPacks.map((p) => p.category));
    return Array.from(seen);
  }, []);

  const filtered = useMemo(() => {
    let packs = activeCategory === 'all'
      ? builtinPacks
      : builtinPacks.filter((p) => p.category === activeCategory);

    if (sort === 'az') {
      packs = [...packs].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } else if (sort === 'progress') {
      packs = [...packs].sort((a, b) => (progressMap[b.id]?.pct ?? 0) - (progressMap[a.id]?.pct ?? 0));
    }

    return packs;
  }, [activeCategory, sort, progressMap]);

  return (
    <div className="marketplace">

      {/* Sticky filter bar */}
      <div className="market-bar">
        <div className="market-cats">
          <button
            className={`market-cat${activeCategory === 'all' ? ' active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            Все
          </button>
          {availableCats.map((cat) => (
            <button
              key={cat}
              className={`market-cat${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="market-sort-wrap">
          <select
            className="market-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Builtin packs grid */}
      <div className="market-grid">
        {filtered.map((pack) => (
          <MarketCard
            key={pack.id}
            pack={pack}
            progress={progressMap[pack.id] ?? { done: 0, total: 0, pct: 0 }}
          />
        ))}
      </div>

      {/* User packs section */}
      {userState.hydrated && (
        <div className="market-section">
          <div className="market-section-header">
            <span className="market-section-title">Мои наборы</span>
            <CreatePackButton />
          </div>
          {userState.packs.length === 0 ? (
            <div className="market-empty">
              Создай свой набор знаний — добавляй темы, вопросы и делай заметки
            </div>
          ) : (
            <div className="market-grid">
              {userState.packs.map((pack) => (
                <Link key={pack.id} href={`/knowledge/${pack.id}`} className="market-card">
                  <div className="market-card-cat">Мой набор</div>
                  <div className="market-card-title">{pack.title}</div>
                  {pack.description && (
                    <div className="market-card-desc">{pack.description}</div>
                  )}
                  <div style={{ flex: 1 }} />
                  <div className="market-card-footer">
                    <span className="market-card-stats">Пользовательский</span>
                    <span className="market-card-open">Открыть <Icon name="arrow-forward" size={11} /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
