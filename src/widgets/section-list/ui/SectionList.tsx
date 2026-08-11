'use client';

import { usePrepStore, useFilteredSections } from '@/entities/section';
import { SectionCard } from './SectionCard';
import { SectionListSkeleton } from './SectionListSkeleton';

export function SectionList() {
  const { state } = usePrepStore();
  const sections = useFilteredSections();

  if (!state.hydrated) return <SectionListSkeleton />;

  if (sections.length === 0) {
    return <div className="empty-state">Нет тем по выбранному фильтру</div>;
  }

  return (
    <div className="sections-wrap">
      {sections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}
    </div>
  );
}
