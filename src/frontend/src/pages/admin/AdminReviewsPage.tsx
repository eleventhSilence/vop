import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/entities/review/api';
import type { ReviewStatus } from '@/entities/review/types';
import { extractApiError } from '@/shared/api/client';
import { formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminReviewsPage = ({ pendingOnly = false }: { pendingOnly?: boolean }) => {
  const queryClient = useQueryClient();
  const reviewsQuery = useQuery({
    queryKey: pendingOnly ? ['admin', 'reviews', 'pending'] : ['admin', 'reviews'],
    queryFn: () => (pendingOnly ? reviewsApi.adminPending() : reviewsApi.adminList()),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: string; status: Extract<ReviewStatus, 'approved' | 'rejected'> }) => reviewsApi.adminModerate(reviewId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews', 'pending'], exact: true }),
      ]);
    },
  });

  const reviews = reviewsQuery.data ? ensurePaginated(reviewsQuery.data).results : [];
  const pageTitle = pendingOnly ? 'Отзывы на модерации' : 'Все отзывы';
  const endpointLabel = pendingOnly ? '/api/admin/reviews/pending/' : '/api/admin/reviews/';

  return (
    <PageSection>
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>{pageTitle}</h2>
          <p className="muted">
            Страница использует endpoint <code>{endpointLabel}</code>
            {pendingOnly ? ' и показывает только отзывы со статусом pending.' : ' и показывает все отзывы независимо от статуса.'}
          </p>
        </div>
      </div>
      {reviewsQuery.isLoading ? <LoadingState /> : null}
      {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
      {moderateMutation.isError ? <ErrorState message={extractApiError(moderateMutation.error)} /> : null}
      {!reviewsQuery.isLoading && !reviews.length ? <EmptyState message="Отзывы не найдены." /> : null}
      <div className="stack-list">
        {reviews.map((review) => (
          <div className="card" key={review.review_id}>
            <div className="card__row"><h3>{review.course_title}</h3><span>{formatStatus(review.status)}</span></div>
            <p><strong>{review.user_email}</strong></p>
            <p>{review.comment}</p>
            {review.status === 'pending' ? (
              <div className="card__row">
                <Button variant="secondary" onClick={() => moderateMutation.mutate({ reviewId: review.review_id, status: 'approved' })} disabled={moderateMutation.isPending}>Одобрить</Button>
                <Button variant="ghost" onClick={() => moderateMutation.mutate({ reviewId: review.review_id, status: 'rejected' })} disabled={moderateMutation.isPending}>Отклонить</Button>
              </div>
            ) : (
              <p className="muted">Для этого отзыва модерация уже завершена.</p>
            )}
          </div>
        ))}
      </div>
    </PageSection>
  );
};
