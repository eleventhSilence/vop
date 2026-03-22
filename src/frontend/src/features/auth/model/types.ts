import type { SessionUser, TokenPair } from '@/entities/auth/types';

export type AccountDashboard = {
  user: SessionUser;
  stats: {
    enrolled_courses_count: number;
    completed_courses_count: number;
    in_progress_courses_count: number;
  };
  recent_courses: Array<{
    course_id: string;
    title: string;
    short_description: string;
    enrolled_at: string;
    progress_percent: number;
    progress_status: string;
    is_theory_completed: boolean;
    is_test_passed: boolean;
  }>;
  recent_reviews: Array<{
    review_id: string;
    course_id: string;
    course_title: string;
    rating: number;
    comment: string;
    status: string;
    created_at: string;
  }>;
};

export type AuthState = {
  user: SessionUser | null;
  tokens: TokenPair | null;
  isInitialized: boolean;
};
