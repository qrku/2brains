import type { Metadata } from 'next';
import { SpacePage } from '@/widgets/space';

export const metadata: Metadata = { title: 'Пространство — 2brains' };

export default function SpaceRoute() {
  return <SpacePage />;
}
