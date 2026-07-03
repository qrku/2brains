export interface Point {
  id: string;
  text: string;
}

export interface Experience {
  id: string;
  title: string;
  period?: string;
  points: Point[];
  createdAt: string;
}
