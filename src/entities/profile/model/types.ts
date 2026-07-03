export type Level = '' | 'junior' | 'middle' | 'senior' | 'lead';

export const LEVEL_LABELS: Record<Exclude<Level, ''>, string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
  lead:   'Lead',
};

export const AVATAR_OPTIONS = [
  '🦊','🐻','🦁','🐯','🐼','🦝','🦄','🐸',
  '🐬','🦅','🦉','🌙','⚡','🔥','🌊','💎',
  '🚀','🎯','🌟','🧩',
] as const;

export const STACK_SUGGESTIONS = [
  'React','TypeScript','JavaScript','Next.js','Node.js',
  'CSS','Vue','Angular','GraphQL','Docker',
  'Python','Go','PostgreSQL','Redis','MongoDB','AWS',
];

export interface Profile {
  nickname: string;
  avatar: string;
  role: string;
  level: Level;
  stack: string[];
}

export const DEFAULT_PROFILE: Profile = {
  nickname: '',
  avatar: '🦊',
  role: '',
  level: '',
  stack: [],
};
