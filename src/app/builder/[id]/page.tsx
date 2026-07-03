'use client';

import Link from 'next/link';
import { use } from 'react';
import { PageEditor } from '@/widgets/constructor';

export default function ConstructorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="ctor-layout">
      <div className="ctor-back-bar">
        <Link href="/builder" className="ctor-back">← Конструктор</Link>
      </div>
      <PageEditor pageId={id} />
    </div>
  );
}
