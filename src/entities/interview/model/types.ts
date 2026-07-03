export interface Question {
  id: string;
  question: string;
  answer: string;
}

export interface Interview {
  id: string;
  title: string;
  createdAt: string;
  questions: Question[];
}
