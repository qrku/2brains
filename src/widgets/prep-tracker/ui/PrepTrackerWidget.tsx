import Link from 'next/link';
import type { Section } from '@/entities/section';
import { PrepStoreProvider } from '@/app/providers/PrepStoreProvider';
import { ProgressSummary } from '@/widgets/progress-summary';
import { SectionList } from '@/widgets/section-list';
import { FilterBar } from '@/features/filter-sections';
import { AddSectionButton } from '@/features/manage-sections';
import { Icon } from '@/shared/ui/Icon';

interface Props {
  packId: string;
  sections: Section[];
  defaultDoneIds: string[];
  title: string;
  description: string;
  backHref?: string;
}

export function PrepTrackerWidget({ packId, sections, defaultDoneIds, title, description, backHref }: Props) {
  return (
    <div className="container">
      {backHref && (
        <Link href={backHref} className="btn-link ghost" style={{ marginBottom: 24, display: 'inline-flex' }}>
          <Icon name="arrow-back" size={12} /> Знания
        </Link>
      )}
      <div className="header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <PrepStoreProvider packId={packId} defaultSections={sections} defaultDoneIds={defaultDoneIds}>
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
