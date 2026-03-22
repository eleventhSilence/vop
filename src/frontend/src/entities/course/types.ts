export type Course = {
  course_id: string;
  title: string;
  short_description: string;
};

export type CourseDetail = Course & {
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EnrolledCourse = {
  course_id: string;
  title: string;
  short_description: string;
  enrolled_at: string;
  is_theory_completed: boolean;
  progress_percent: number;
  progress_status: string;
  is_test_passed: boolean;
};

export type CourseEnrollment = {
  user_id: string;
  course_id: string;
  progress_status: string;
  is_theory_completed: boolean;
  enrolled_at: string;
};

export type AdminCourse = {
  course_id: string;
  title: string;
  short_description: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};
