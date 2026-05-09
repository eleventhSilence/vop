export type TestQuestionType = 'single_choice' | 'multiple_choice';

export type TestOption = {
  option_id: string;
  text: string;
};

export type TestQuestion = {
  question_id: string;
  text: string;
  order: number;
  question_type: TestQuestionType;
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
  status: string;
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

export type AttemptOptionStatus = 'success' | 'error';

export type TestAttemptDetailOption = {
  option_id: string;
  text: string;
  status: AttemptOptionStatus;
};

export type TestAttemptDetailQuestion = {
  question_id: string;
  text: string;
  order: number;
  question_type: TestQuestionType;
  result: AttemptOptionStatus;
  selected_options: TestAttemptDetailOption[];
};

export type TestAttemptDetail = {
  attempt_id: string;
  created_at: string;
  score: number;
  percent: number;
  is_passed: boolean;
  attempt_number: number;
  questions: TestAttemptDetailQuestion[];
};

export type ActiveAttemptResponse = {
  active_attempt: { attempt_id: string; status: string } | null;
};

export type StartedAttempt = {
  attempt_id: string;
  status: string;
};
