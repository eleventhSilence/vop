import { http } from '@/shared/api/http';
import type { AdminReview, Review, ReviewStatus, ReviewWritePayload } from '@/entities/review/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';

export const reviewsApi = {
  listByCourse(courseId: string) {
    return http.get<PaginatedResponse<Review>>(`/reviews/course/${courseId}/`).then((response) => response.data);
  },
  myReviews() {
    return http.get<PaginatedResponse<Review>>('/reviews/my/').then((response) => response.data);
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
  adminList(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminReview>>('/admin/reviews/', { params }).then((response) => response.data);
  },
  adminPending() {
    return http.get<PaginatedResponse<AdminReview>>('/admin/reviews/pending/').then((response) => response.data);
  },
  adminModerate(reviewId: string, status: Extract<ReviewStatus, 'approved' | 'rejected'>) {
    return http.patch<AdminReview>(`/admin/reviews/${reviewId}/`, { status }).then((response) => response.data);
  },
};
