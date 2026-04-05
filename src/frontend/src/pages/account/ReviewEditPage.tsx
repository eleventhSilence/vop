import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { reviewsApi } from '@/entities/review/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

export const ReviewEditPage = () => {
  const { reviewId } = useParams<{ reviewId: string }>();

  const reviewQuery = useQuery({ queryKey: ['reviews', 'my'], queryFn: reviewsApi.myReviews });

  const review = useMemo(() => {
    if (!reviewId || !reviewQuery.data) {
      return undefined;
    }
    return ensurePaginated(reviewQuery.data).results.find((item) => item.review_id === reviewId);
  }, [reviewId, reviewQuery.data]);

  const [draft, setDraft] = useState({ comment: '', rating: 5 });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!reviewId) {
        throw new Error('Не удалось определить ID отзыва.');
      }
      return reviewsApi.update(reviewId, draft);
    },
    onSuccess: async (updatedReview) => {
      setDraft({ comment: updatedReview.comment, rating: updatedReview.rating });
      await reviewQuery.refetch();
    },
  });

  const isReady = Boolean(review) && !reviewQuery.isLoading && !reviewQuery.isError;

  useEffect(() => {
    if (review) {
      setDraft({ comment: review.comment, rating: review.rating });
    }
  }, [review]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isReady) {
      return;
    }
    updateMutation.mutate();
  };

  if (reviewQuery.isLoading) {
    return (
      <PageSection>
        <LoadingState message="Загружаем отзыв..." />
      </PageSection>
    );
  }

  if (reviewQuery.isError) {
    return (
      <PageSection>
        <ErrorState message={extractApiError(reviewQuery.error)} />
        <Link to="/account/reviews" className="text-link">← Вернуться к списку отзывов</Link>
      </PageSection>
    );
  }

  if (!reviewId || !review) {
    return (
      <PageSection>
        <EmptyState message="Отзыв не найден или недоступен для редактирования." />
        <Link to="/account/reviews" className="text-link">← Вернуться к списку отзывов</Link>
      </PageSection>
    );
  }


  return (
    <PageSection>
      <div className="card form-stack">
        <div>
          <p className="eyebrow">Личный кабинет</p>
          <h2>Редактирование отзыва</h2>
          <p className="muted">ID отзыва: {review.review_id}</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <Input
            id="edit-review-comment"
            label="Комментарий"
            value={draft.comment}
            onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
            required
            disabled={updateMutation.isPending}
          />
          <Input
            id="edit-review-rating"
            label="Оценка"
            type="number"
            min={1}
            max={5}
            value={draft.rating}
            onChange={(event) => setDraft((current) => ({ ...current, rating: Number(event.target.value) }))}
            required
            disabled={updateMutation.isPending}
          />
          <div className="card__row">
            <Button type="submit" disabled={updateMutation.isPending}>Сохранить изменения</Button>
            <Link to="/account/reviews" className="text-link">← К списку отзывов</Link>
          </div>
          {updateMutation.isError ? <ErrorState message={extractApiError(updateMutation.error)} /> : null}
          {updateMutation.isSuccess ? <div className="state-box">Изменения сохранены.</div> : null}
        </form>
      </div>
    </PageSection>
  );
};
