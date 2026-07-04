'use client';

import Link from 'next/link';
import { use } from 'react';
import { PageEditor } from '@/widgets/constructor';
import { Icon } from '@/shared/ui/Icon';

export default function ConstructorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="ctor-layout">
      <div className="ctor-back-bar">
        <Link href="/builder" className="ctor-back"><Icon name="arrow-back" size={12} /> Конструктор</Link>
      </div>
      <PageEditor pageId={id} />
    </div>
  );
}
