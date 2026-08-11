import type { IconName } from '@/shared/ui/Icon';
import type { NodeShape, TextAlign } from '@/entities/board';
import type { Tool } from '../model/types';

export const TOOLS: { id: Tool; label: string; icon: IconName }[] = [
  { id: 'hand', label: 'Рука', icon: 'hand' },
  { id: 'cursor', label: 'Курсор', icon: 'navigation' },
  { id: 'box', label: 'Блок', icon: 'draw' },
  { id: 'text', label: 'Текст', icon: 'text-1' },
  { id: 'frame', label: 'Фрейм', icon: 'grid' },
  { id: 'pencil', label: 'Карандаш', icon: 'edit-01' },
];

export const SHAPES: { id: NodeShape; icon: string; label: string }[] = [
  { id: 'rect', icon: '▭', label: 'Прямоугольник' },
  { id: 'diamond', icon: '◇', label: 'Ромб' },
  { id: 'circle', icon: '○', label: 'Круг' },
];

export const ALIGNS: { id: TextAlign; label: string }[] = [
  { id: 'left', label: 'По левому краю' },
  { id: 'center', label: 'По центру' },
  { id: 'right', label: 'По правому краю' },
];
