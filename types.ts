export enum QuizType {
  MCQ = 'mcq',
  TRUE_FALSE = 'true_false',
}

export interface Question {
  id: number;
  type: QuizType;
  questionText: string;
  options?: string[];
  correctAnswer: string | boolean;
  explanation: string;
  points: number;
}

export interface Flashcard {
  id: number;
  question: string;
  answer: string;
}

export interface LawSectionData {
  id: number;
  sectionNumber: string;
  title: string;
  summary: string;
  fullText?: string;
  scenario: {
    title: string;
    text: string;
  };
  quiz: Question[];
  flashcards?: Flashcard[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockCondition: (completedCount: number, totalSections: number) => boolean;
}

export interface Chapter {
  id: string;
  title: string;
  sections: LawSectionData[];
}

export type Ratings = {
  [sectionId: number]: number[];
};
