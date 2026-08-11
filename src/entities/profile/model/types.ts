export const AVATAR_OPTIONS = [
  '🦊','🐻','🦁','🐯','🐼','🦝','🦄','🐸',
  '🐬','🦅','🦉','🌙','⚡','🔥','🌊','💎',
  '🚀','🎯','🌟','🧩',
] as const;

export interface Profile {
  nickname: string;
  avatar: string;
}

export const DEFAULT_PROFILE: Profile = {
  nickname: '',
  avatar: '🦊',
};
