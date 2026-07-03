export type Priority = 'high' | 'med';

export interface Topic {
  id: string;
  n: string;
  p?: Priority;
}

export interface Section {
  id: string;
  name: string;
  topics: Topic[];
}
