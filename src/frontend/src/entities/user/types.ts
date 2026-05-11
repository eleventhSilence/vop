export type PublicUserReview = {
  id: string;
  course_id: string;
  course_title: string;
  rating: number;
  text: string;
  created_at: string;
};

export type PublicUserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  date_joined: string;
  completed_courses_count: number;
  approved_reviews_count: number;
  latest_reviews: PublicUserReview[];
};
