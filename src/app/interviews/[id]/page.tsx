import { InterviewDetail } from '@/widgets/interview-detail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InterviewDetailPage({ params }: Props) {
  const { id } = await params;
  return <main><InterviewDetail id={id} /></main>;
}
