export type AdminDashboard = {
  users: {
    total_users: number;
    active_users_count: number;
    blocked_users_count: number;
    admins_count: number;
    regular_users_count: number;
  };
  courses: {
    total_courses: number;
    available_courses_count: number;
    unavailable_courses_count: number;
  };
  reviews: {
    total_reviews: number;
    pending_reviews_count: number;
    approved_reviews_count: number;
    rejected_reviews_count: number;
  };
  testing: {
    total_tests: number;
    total_questions: number;
    total_answer_options: number;
  };
  recent_users: Array<{
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    status: string;
    registered_at: string;
  }>;
  pending_reviews: Array<{
    review_id: string;
    user_email: string;
    course_title: string;
    rating: number;
    comment: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
};

export type AdminUser = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  registered_at: string;
  last_login_at: string | null;
};

export type AdminUserDetail = AdminUser & {
  enrolled_courses_count: number;
  reviews_count: number;
};

export type AdminUserUpdatePayload = Partial<Pick<AdminUser, 'first_name' | 'last_name' | 'role' | 'status'>>;

export type AdminTest = {
  test_id: string;
  course_id: string;
  course_title: string;
  title: string;
  description: string;
  passing_score: number;
  max_attempts: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminTestUpdatePayload = Partial<Pick<AdminTest, 'title' | 'description' | 'passing_score' | 'max_attempts' | 'is_active'>>;

export type AdminTestCreatePayload = Pick<AdminTest, 'course_id' | 'title' | 'description' | 'passing_score' | 'max_attempts' | 'is_active'>;

export type AdminQuestionType = 'single_choice' | 'multiple_choice';

export type AdminTestQuestion = {
  question_id: string;
  test_id: string;
  test_title: string;
  text: string;
  order: number;
  question_type: AdminQuestionType;
  created_at: string;
  updated_at: string;
};

export type AdminTestQuestionCreatePayload = Pick<AdminTestQuestion, 'test_id' | 'text' | 'order' | 'question_type'>;
export type AdminTestQuestionUpdatePayload = Partial<Pick<AdminTestQuestion, 'text' | 'order' | 'question_type'>>;

export type AdminAnswerOption = {
  option_id: string;
  question_id: string;
  question_text: string;
  text: string;
  is_correct: boolean;
  order: number;
  created_at: string;
  updated_at: string;
};

export type AdminAnswerOptionCreatePayload = Pick<AdminAnswerOption, 'question_id' | 'text' | 'is_correct' | 'order'>;
export type AdminAnswerOptionUpdatePayload = Partial<Pick<AdminAnswerOption, 'text' | 'is_correct' | 'order'>>;

export type AdminCourseStatus = 'available' | 'unavailable';

export type AdminCourse = {
  course_id: string;
  title: string;
  short_description: string;
  content: string;
  status: AdminCourseStatus;
  created_at: string;
  updated_at: string;
};

export type AdminCourseCreatePayload = Pick<AdminCourse, 'title' | 'short_description' | 'content' | 'status'>;
export type AdminCourseUpdatePayload = Partial<Pick<AdminCourse, 'title' | 'short_description' | 'content' | 'status'>>;

export type AdminCourseListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: 'all' | AdminCourseStatus;
};

export type AdminTestListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: 'all' | AdminCourseStatus | 'active' | 'inactive';
};
