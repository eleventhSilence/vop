import { http } from '@/shared/api/http';
import type {
  AdminReview,
  AdminReviewListParams,
  CourseReviewsParams,
  Review,
  ReviewStatus,
  ReviewWritePayload,
} from '@/entities/review/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';

export const reviewsApi = {
  listByCourse(courseId: string, params?: CourseReviewsParams) {
    return http.get<PaginatedResponse<Review>>(`/reviews/course/${courseId}/`, { params }).then((response) => response.data);
  },
  myReviews(params?: { page?: number; page_size?: number }) {
    return http.get<PaginatedResponse<Review>>('/reviews/my/', { params }).then((response) => response.data);
  },
  availableCourses(params?: { page?: number; page_size?: number }) {
    return http.get<PaginatedResponse<{ course_id: string; title: string; short_description: string; enrolled_at: string }>>('/reviews/available-courses/', { params }).then((response) => response.data);
  },
  create(payload: ReviewWritePayload) {
    return http.post<Review>('/reviews/', payload).then((response) => response.data);
  },
  update(reviewId: string, payload: Partial<Pick<ReviewWritePayload, 'comment' | 'rating'>>) {
    return http.patch<Review>(`/reviews/${reviewId}/`, payload).then((response) => response.data);
  },
  remove(reviewId: string) {
    return http.delete(`/reviews/${reviewId}/`);
  },
  adminList(params?: AdminReviewListParams) {
    return http.get<PaginatedResponse<AdminReview>>('/admin/reviews/', { params }).then((response) => response.data);
  },
  adminPending(params?: Pick<AdminReviewListParams, 'page' | 'search'>) {
    return http.get<PaginatedResponse<AdminReview>>('/admin/reviews/pending/', { params }).then((response) => response.data);
  },
  adminModerate(reviewId: string, status: ReviewStatus) {
    return http.patch<AdminReview>(`/admin/reviews/${reviewId}/`, { status }).then((response) => response.data);
  },
};
