export type Review = {
  review_id: string;
  comment: string;
  rating: number;
  status?: string;
  created_at: string;
  updated_at?: string;
  course_id?: string;
  course_title?: string;
};

export type AdminReview = {
  review_id: string;
  user_id: string;
  user_email: string;
  course_id: string;
  course_title: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ReviewWritePayload = {
  course_id: string;
  comment: string;
  rating: number;
};
