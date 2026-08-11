import { Suspense } from 'react';
import { builtinPacks, type BuiltinPackDef } from '@/entities/pack';
import { PrepTracker } from '@/app/_components/PrepTracker';
import { ProgressSummarySkeleton } from '@/widgets/progress-summary';
import { SectionListSkeleton } from '@/widgets/section-list';
import { UserPackDetailClient } from './UserPackDetailClient';

function PackDetailSkeleton() {
  return (
    <div className="container">
      <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 3, marginBottom: 28 }} />
      <div className="skeleton" style={{ width: 220, height: 26, borderRadius: 3, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 280, height: 14, borderRadius: 3, marginBottom: 32 }} />
      <ProgressSummarySkeleton />
      <SectionListSkeleton />
    </div>
  );
}

// Async wrapper makes this subtree suspendable for streaming
async function BuiltinPackLoader({ pack }: { pack: BuiltinPackDef }) {
  await new Promise<void>((r) => setTimeout(r, 60));
  return (
    <PrepTracker
      packId={pack.id}
      sections={pack.sections}
      defaultDoneIds={pack.defaultDoneIds}
      title={pack.title}
      description={pack.description}
      backHref="/"
    />
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PackDetailPage({ params }: Props) {
  const { id } = await params;
  const builtin = builtinPacks.find((p) => p.id === id);

  if (builtin) {
    return (
      <main>
        <Suspense fallback={<PackDetailSkeleton />}>
          <BuiltinPackLoader pack={builtin} />
        </Suspense>
      </main>
    );
  }

  return (
    <main>
      <UserPackDetailClient id={id} />
    </main>
  );
}
