export type ProgressAttempt = {
  attempt_id: string;
  score: number;
  is_passed: boolean;
  attempt_number: number;
  created_at: string;
};

export type CourseProgress = {
  course_id: string;
  course_title: string;
  progress_percent: number;
  progress_status: string;
  is_theory_completed: boolean;
  total_attempts: number;
  best_score: number | null;
  is_test_passed: boolean;
};

export type CourseProgressDetail = CourseProgress & {
  theory_completed_at: string | null;
  attempts: ProgressAttempt[];
};
