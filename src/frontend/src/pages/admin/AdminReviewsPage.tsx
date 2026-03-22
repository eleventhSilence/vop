import { useMutation, useQuery } from '@tanstack/react-query';
import { reviewsApi } from '@/entities/review/api';
import { extractApiError } from '@/shared/api/client';
import { formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminReviewsPage = () => {
  const reviewsQuery = useQuery({ queryKey: ['admin', 'reviews'], queryFn: reviewsApi.adminPending });
  const moderateMutation = useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: string; status: 'APPROVED' | 'REJECTED' }) => reviewsApi.adminModerate(reviewId, status),
    onSuccess: async () => {
      await reviewsQuery.refetch();
    },
  });
  const reviews = reviewsQuery.data ? ensurePaginated(reviewsQuery.data).results : [];

  return (
    <PageSection>
      <h2>Администратор: отзывы</h2>
      <p className="muted">На первом этапе страница показывает очередь модерации и даёт базовые approve/reject actions через <code>/api/admin/reviews/:id/</code>.</p>
      {reviewsQuery.isLoading ? <LoadingState /> : null}
      {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
      {moderateMutation.isError ? <ErrorState message={extractApiError(moderateMutation.error)} /> : null}
      <div className="stack-list">
        {reviews.map((review) => (
          <div className="card" key={review.review_id}>
            <div className="card__row"><h3>{review.course_title}</h3><span>{formatStatus(review.status)}</span></div>
            <p><strong>{review.user_email}</strong></p>
            <p>{review.comment}</p>
            <div className="card__row">
              <Button variant="secondary" onClick={() => moderateMutation.mutate({ reviewId: review.review_id, status: 'APPROVED' })} disabled={moderateMutation.isPending}>Одобрить</Button>
              <Button variant="ghost" onClick={() => moderateMutation.mutate({ reviewId: review.review_id, status: 'REJECTED' })} disabled={moderateMutation.isPending}>Отклонить</Button>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
};
