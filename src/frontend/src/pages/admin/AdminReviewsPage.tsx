import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/entities/review/api';
import type { AdminReview, ReviewStatus } from '@/entities/review/types';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { RatingStars } from '@/shared/ui/RatingStars';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Toast } from '@/shared/ui/Toast';

const getPageFromUrl = (url: string | null) => {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url, 'http://localhost');
    const page = parsedUrl.searchParams.get('page');
    return page ? Number(page) : null;
  } catch {
    return null;
  }
};

const getReviewStatusTone = (status: ReviewStatus) => {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'accent';
};

const getReviewAuthorLabel = (review: AdminReview) => {
  const fullName = [review.user_first_name, review.user_last_name].filter(Boolean).join(' ').trim();
  return fullName || review.user_email;
};

export const AdminReviewsPage = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('pending');
  const [knownPageSize, setKnownPageSize] = useState<number | null>(null);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const reviewsQuery = useQuery({
    queryKey: ['admin', 'reviews', page, search, statusFilter],
    queryFn: () => reviewsApi.adminList({ page, search: search || undefined, status: statusFilter }),
  });

  const paginatedReviews = reviewsQuery.data ? ensurePaginated(reviewsQuery.data) : { count: 0, next: null, previous: null, results: [] };
  const reviews = paginatedReviews.results;
  const hasNextPage = Boolean(paginatedReviews.next);
  const hasPreviousPage = Boolean(paginatedReviews.previous);
  const nextPage = getPageFromUrl(paginatedReviews.next) ?? (hasNextPage ? page + 1 : null);
  const previousPage = getPageFromUrl(paginatedReviews.previous) ?? (hasPreviousPage ? Math.max(1, page - 1) : null);
  const pageSize = knownPageSize ?? (reviews.length || 1);
  const totalPages = Math.max(1, Math.ceil(paginatedReviews.count / pageSize));

  useEffect(() => {
    if (reviews.length && (!knownPageSize || reviews.length > knownPageSize)) {
      setKnownPageSize(reviews.length);
    }
  }, [knownPageSize, reviews.length]);

  const moderateMutation = useMutation({
    mutationFn: ({ reviewId, status }: { reviewId: string; status: ReviewStatus }) => reviewsApi.adminModerate(reviewId, status),
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      if (variables.status === 'pending') {
        setSelectedReview(data);
        setToast({ type: 'success', message: 'Отзыв возвращён на модерацию.' });
      } else {
        setSelectedReview(null);
        setToast({ type: 'success', message: variables.status === 'approved' ? 'Отзыв одобрен.' : 'Отзыв отклонён.' });
      }
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const handleOverlayStatusChange = (status: ReviewStatus) => {
    if (!selectedReview) return;
    moderateMutation.mutate({ reviewId: selectedReview.review_id, status });
  };

  return (
    <PageSection className="page-section--wide">
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Администрирование отзывов</h2>
        </div>
      </div>
      <div className="admin-page-controls admin-users-toolbar">
        <div className="card admin-list-filters admin-list-filters--panel">
          <Input
            id="admin-review-search"
            label="Поиск"
            placeholder="Поиск по отзывам"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <label className="field" htmlFor="admin-reviews-status-filter">
            <span className="field__label">Статус</span>
            <select
              id="admin-reviews-status-filter"
              className="field__control"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ReviewStatus)}
            >
              <option value="all">Все статусы</option>
              <option value="pending">На модерации</option>
              <option value="approved">Одобрен</option>
              <option value="rejected">Отклонён</option>
            </select>
          </label>
        </div>
      </div>
      {reviewsQuery.isLoading ? <LoadingState /> : null}
      {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
      {!reviewsQuery.isLoading && !reviews.length ? <EmptyState message="Отзывы не найдены." /> : null}

      <div className="details-layout admin-users-layout">
        <div className="table-card admin-users-table-panel">
          <div className="table-card__header">
            <div>
              <strong>Всего отзывов: {paginatedReviews.count}</strong>
              <p className="muted">Страница {page} из {totalPages}. Сейчас показано {reviews.length} записей.</p>
            </div>
            <div className="pagination-controls" aria-label="Пагинация отзывов">
              <Button variant="ghost" onClick={() => previousPage !== null && setPage(previousPage)} disabled={!hasPreviousPage || reviewsQuery.isLoading}>Назад</Button>
              <span className="pagination-controls__status">Страница {page}</span>
              <Button variant="ghost" onClick={() => nextPage !== null && setPage(nextPage)} disabled={!hasNextPage || reviewsQuery.isLoading}>Вперёд</Button>
            </div>
          </div>
          <div className="admin-users-table-wrap">
            <table className="users-table">
              <thead><tr><th>Курс</th><th>Автор</th><th>Отзыв</th><th>Оценка</th><th>Статус</th><th>Дата обновления</th></tr></thead>
              <tbody>
                {reviews.map((review) => (
                  <tr
                    key={review.review_id}
                    className="users-table__row"
                    onClick={() => setSelectedReview(review)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedReview(review);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    title="Открыть модерацию отзыва"
                  >
                    <td><strong>{review.course_title}</strong></td>
                    <td><strong>{getReviewAuthorLabel(review)}</strong><div className="muted">{review.user_email}</div></td>
                    <td className="table-review-comment-cell"><p className="table-review-comment-text">{review.comment}</p></td>
                    <td><RatingStars rating={review.rating} ariaLabel="Оценка отзыва" /></td>
                    <td><StatusBadge status={review.status} label={formatStatus(review.status)} tone={getReviewStatusTone(review.status)} /></td>
                    <td>{formatDateTime(review.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedReview ? (
        <div className="overlay" role="presentation" onClick={() => setSelectedReview(null)}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row"><h3>Модерация отзыва</h3></div>
            <section className="admin-user-panel__section">
              <div className="grid-2">
                <div><p className="muted">Курс</p><strong>{selectedReview.course_title}</strong></div>
                <div><p className="muted">Автор</p><strong>{getReviewAuthorLabel(selectedReview)}</strong></div>
                <div><p className="muted">Email автора</p><strong>{selectedReview.user_email}</strong></div>
                <div><p className="muted">Оценка</p><strong><RatingStars rating={selectedReview.rating} ariaLabel="Оценка в модерации" /></strong></div>
                <div><p className="muted">Статус</p><StatusBadge status={selectedReview.status} label={formatStatus(selectedReview.status)} tone={getReviewStatusTone(selectedReview.status)} /></div>
              </div>
              <div>
                <p className="muted">Текст отзыва</p>
                <p>{selectedReview.comment}</p>
              </div>
            </section>
            <section className="admin-user-panel__section">
              <div className="admin-user-panel__section-head"><p className="eyebrow">Служебная информация</p></div>
              <div className="admin-user-panel__meta grid-2">
                <div className="admin-user-panel__value-block"><p className="muted">Дата создания</p><strong>{formatDateTime(selectedReview.created_at)}</strong></div>
                <div className="admin-user-panel__value-block"><p className="muted">Дата обновления</p><strong>{formatDateTime(selectedReview.updated_at)}</strong></div>
              </div>
            </section>
            <div className="users-actions__buttons">
              {selectedReview.status === 'pending' ? (
                <>
                  <Button variant="secondary" onClick={() => handleOverlayStatusChange('approved')} disabled={moderateMutation.isPending}>Одобрить</Button>
                  <Button variant="ghost" onClick={() => handleOverlayStatusChange('rejected')} disabled={moderateMutation.isPending}>Отклонить</Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => handleOverlayStatusChange('pending')} disabled={moderateMutation.isPending}>Изменить решение</Button>
              )}
              <Button variant="ghost" onClick={() => setSelectedReview(null)} disabled={moderateMutation.isPending}>Закрыть</Button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
