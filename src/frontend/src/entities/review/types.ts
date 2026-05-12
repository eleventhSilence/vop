export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type Review = {
  review_id: string;
  course_id?: string;
  author_id?: string | null;
  author_name?: string | null;
  comment: string;
  rating: number;
  status?: ReviewStatus;
  created_at: string;
  updated_at?: string;
  course_title?: string | null;
  course_is_available?: boolean | null;
  course?: {
    id?: string | null;
    title?: string | null;
    name?: string | null;
    status?: string | null;
  } | null;
};

export type CourseReviewsParams = {
  page?: number;
  page_size?: number;
  rating?: 'all' | '1' | '2' | '3' | '4' | '5';
};

export type AdminReview = {
  review_id: string;
  user_id: string;
  user_email: string;
  course_id: string;
  course_title: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

export type AdminReviewListParams = {
  page?: number;
  search?: string;
  status?: 'all' | ReviewStatus;
};

export type ReviewWritePayload = {
  course_id: string;
  comment: string;
  rating: number;
};
