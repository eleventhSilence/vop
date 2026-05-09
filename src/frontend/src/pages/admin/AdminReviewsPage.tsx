import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/entities/review/api';
import type { ReviewStatus } from '@/entities/review/types';
import { extractApiError } from '@/shared/api/client';
import { formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminReviewsPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Extract<ReviewStatus, 'pending' | 'approved' | 'rejected'>>('all');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const reviewsQuery = useQuery({
    queryKey: ['admin', 'reviews', page, search, statusFilter],
    queryFn: () => reviewsApi.adminList({ page, search: search || undefined, status: statusFilter }),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: string; status: Extract<ReviewStatus, 'approved' | 'rejected'> }) => reviewsApi.adminModerate(reviewId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
  });

  const reviews = reviewsQuery.data ? ensurePaginated(reviewsQuery.data).results : [];

  return (
    <PageSection>
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Администрирование отзывов</h2>
        </div>
      </div>
      <div className="admin-users-toolbar">
        <div className="admin-list-filters">
          <Input
            id="admin-review-search"
            label="Поиск"
            placeholder="Поиск по отзывам"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            id="admin-reviews-status-filter"
            className="field__control"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | Extract<ReviewStatus, 'pending' | 'approved' | 'rejected'>)}
          >
            <option value="all">Все статусы</option>
            <option value="pending">На модерации</option>
            <option value="approved">Одобрен</option>
            <option value="rejected">Отклонён</option>
          </select>
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
