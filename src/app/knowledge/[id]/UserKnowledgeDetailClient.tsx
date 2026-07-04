'use client';

import Link from 'next/link';
import { useUserPacksStore } from '@/app/providers/UserPacksStoreProvider';
import { PrepStoreProvider } from '@/app/providers/PrepStoreProvider';
import { ProgressSummary } from '@/widgets/progress-summary';
import { SectionList } from '@/widgets/section-list';
import { FilterBar } from '@/features/filter-sections';
import { AddSectionButton } from '@/features/manage-sections';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  id: string;
}

export function UserKnowledgeDetailClient({ id }: Props) {
  const { state } = useUserPacksStore();

  if (!state.hydrated) {
    return (
      <div className="container">
        <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 3, marginBottom: 28 }} />
        <div className="skeleton" style={{ width: 220, height: 26, borderRadius: 3, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 280, height: 14, borderRadius: 3, marginBottom: 32 }} />
      </div>
    );
  }

  const pack = state.packs.find((p) => p.id === id);

  if (!pack) {
    return (
      <div className="container">
        <Link href="/knowledge" className="btn-link ghost" style={{ marginBottom: 28, display: 'inline-flex' }}>
          <Icon name="arrow-back" size={12} /> Знания
        </Link>
        <div className="empty-state" style={{ marginTop: 64 }}>Набор не найден</div>
      </div>
    );
  }

  return (
    <div className="container">
      <Link href="/knowledge" className="btn-link ghost" style={{ marginBottom: 24, display: 'inline-flex' }}>
        <Icon name="arrow-back" size={12} /> Знания
      </Link>
      <div className="header">
        <h1>{pack.title}</h1>
        {pack.description && <p>{pack.description}</p>}
      </div>
      <PrepStoreProvider packId={pack.id} defaultSections={[]} defaultDoneIds={[]}>
        <ProgressSummary />
        <div className="toolbar">
          <FilterBar />
          <AddSectionButton />
        </div>
        <SectionList />
      </PrepStoreProvider>
    </div>
  );
}
