import type { Section } from '@/entities/section';

export type PackCategory =
  | 'frontend'
  | 'backend'
  | 'mobile'
  | 'cs'
  | 'design'
  | 'devops'
  | 'languages'
  | 'other';

export const CATEGORY_LABELS: Record<PackCategory, string> = {
  frontend:  'Frontend',
  backend:   'Backend',
  mobile:    'Mobile',
  cs:        'CS / Алгоритмы',
  design:    'Дизайн',
  devops:    'DevOps',
  languages: 'Языки',
  other:     'Другое',
};

export interface BuiltinPackDef {
  id: string;
  title: string;
  description: string;
  category: PackCategory;
  tags: string[];
  sections: Section[];
  defaultDoneIds: string[];
}

export interface UserPack {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}
