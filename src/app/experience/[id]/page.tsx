import { ExperienceDetail } from '@/widgets/experience-detail';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ExperienceDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <main>
      <ExperienceDetail id={id} />
    </main>
  );
}
