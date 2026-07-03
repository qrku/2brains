import type { Metadata } from 'next';
import { KnowledgeMarketplace } from '@/widgets/knowledge-marketplace';

export const metadata: Metadata = { title: 'Знания — 2brain' };

export default function KnowledgePage() {
  return (
    <main className="page-market">
      <div className="market-header">
        <h1 className="market-title">Знания</h1>
        <p className="market-subtitle">
          Готовые наборы тем и свои базы — всё что нужно знать в нужный момент
        </p>
      </div>
      <KnowledgeMarketplace />
    </main>
  );
}
