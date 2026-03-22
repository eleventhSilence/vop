export type TestOption = {
  option_id: string;
  text: string;
};

export type TestQuestion = {
  question_id: string;
  text: string;
  order: number;
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  options: TestOption[];
};

export type CourseTestInfo = {
  has_test: boolean;
  test_id: string | null;
  title: string | null;
  description: string | null;
  passing_score: number | null;
  max_attempts: number | null;
  questions: TestQuestion[];
};

export type TestAttempt = {
  attempt_id: string;
  score: number;
  is_passed: boolean;
  attempt_number: number;
  created_at: string;
};

export type TestSubmitResult = {
  attempt_id: string;
  score: number;
  is_passed: boolean;
  attempt_number: number;
  remaining_attempts: number;
};
