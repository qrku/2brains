import type { Metadata } from 'next';
import { InterviewDetail } from '@/widgets/interview-detail';

export const metadata: Metadata = { title: 'Тест — 2brain' };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TestDetailPage({ params }: Props) {
  const { id } = await params;
  return <main><InterviewDetail id={id} /></main>;
}
