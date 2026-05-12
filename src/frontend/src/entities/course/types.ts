export type CourseMedia = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  media_type: 'image' | 'video' | 'document';
  original_name: string;
  file_size: number;
  file_url: string;
  markdown_image_snippet: string | null;
  markdown_embed_snippet: string;
  uploaded_at: string;
};

export type CourseStatus = 'available' | 'unavailable';

export type ProgressStatus = 'enrolled' | 'theory_completed' | 'testing_in_progress' | 'completed';

export type Course = {
  course_id: string;
  title: string;
  short_description: string;
  is_enrolled: boolean;
};

export type CourseDetail = Course & {
  content: string;
  media?: CourseMedia[];
  status: CourseStatus;
  created_at: string;
  updated_at: string;
  participants_count: number;
  review_count?: number;
};

export type EnrolledCourse = {
  course_id: string;
  title: string;
  short_description: string;
  enrolled_at: string;
  is_theory_completed: boolean;
  progress_percent: number;
  progress_status: ProgressStatus;
  is_test_passed: boolean;
};

export type CourseEnrollment = {
  user_id: string;
  course_id: string;
  progress_status: ProgressStatus;
  is_theory_completed: boolean;
  enrolled_at: string;
};

export type AdminCourse = {
  course_id: string;
  title: string;
  short_description: string;
  content: string;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
};

export type CourseCatalogEnrollmentFilter = 'all' | 'enrolled' | 'not_enrolled';

export type CourseCatalogQueryParams = {
  page?: number;
  page_size?: number;
  search?: string;
  enrollment?: CourseCatalogEnrollmentFilter;
};

export type MyCoursesProgressFilter = 'all' | '25' | '50' | '75' | '100';

export type MyCoursesQueryParams = {
  page?: number;
  page_size?: number;
  search?: string;
  progress?: MyCoursesProgressFilter;
};
