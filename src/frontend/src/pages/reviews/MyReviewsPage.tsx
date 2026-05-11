import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { reviewsApi } from '@/entities/review/api';
import type { Review, ReviewStatus } from '@/entities/review/types';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Toast } from '@/shared/ui/Toast';

export const MyReviewsPage = () => {
  const [draft, setDraft] = useState({ course_id: '', comment: '', rating: 5 });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const reviewsQuery = useQuery({ queryKey: ['reviews', 'my'], queryFn: reviewsApi.myReviews });
  const coursesQuery = useQuery({ queryKey: ['courses', 'my'], queryFn: coursesApi.myCourses });

  const reviews = useMemo(
    () => (reviewsQuery.data ? ensurePaginated(reviewsQuery.data).results : []),
    [reviewsQuery.data],
  );
  const courses = useMemo(
    () => (coursesQuery.data ? ensurePaginated(coursesQuery.data).results : []),
    [coursesQuery.data],
  );

  const reviewedCourseIds = useMemo(() => new Set(reviews.map((review) => review.course_id)), [reviews]);
  const availableCourses = useMemo(
    () => courses.filter((course) => !reviewedCourseIds.has(course.course_id)),
    [courses, reviewedCourseIds],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!availableCourses.length) {
      setDraft((current) => ({ ...current, course_id: '' }));
      return;
    }
    if (!draft.course_id || !availableCourses.some((course) => course.course_id === draft.course_id)) {
      setDraft((current) => ({ ...current, course_id: availableCourses[0].course_id }));
    }
  }, [availableCourses, draft.course_id]);

  const createMutation = useMutation({
    mutationFn: () => reviewsApi.create(draft),
    onSuccess: async () => {
      setDraft({ course_id: '', comment: '', rating: 5 });
      setToast({ type: 'success', message: 'Отзыв сохранён. После модерации он появится на публичной странице курса.' });
      await Promise.all([reviewsQuery.refetch(), coursesQuery.refetch()]);
    },
    onError: () => {
      setToast({ type: 'error', message: 'Не удалось сохранить отзыв. Попробуйте ещё раз.' });
    },
  });

  const isCoursesLoading = coursesQuery.isLoading;
  const isCoursesError = coursesQuery.isError;
  const canCreateReview = !isCoursesLoading && !isCoursesError && availableCourses.length > 0;

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateReview || !draft.course_id) {
      return;
    }
    createMutation.mutate();
  };

  return (
    <PageSection>
      <div className="form-stack">
        <header className="section-header">
          <p className="eyebrow">ОТЗЫВЫ</p>
          <h1>Мои отзывы</h1>
        </header>

        <section className="card form-stack">
          <h2>Оставленные отзывы</h2>
          {reviewsQuery.isLoading ? <LoadingState /> : null}
          {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
          {!reviewsQuery.isLoading && !reviewsQuery.isError && !reviews.length ? (
            <EmptyState message="Вы пока не оставили ни одного отзыва." />
          ) : null}

          <div className="stack-list">
            {reviews.map((review) => (
              <ReviewCard
                key={review.review_id}
                review={review}
                onToast={setToast}
                onUpdated={() => reviewsQuery.refetch()}
                onDeleted={async () => {
                  await Promise.all([reviewsQuery.refetch(), coursesQuery.refetch()]);
                }}
              />
            ))}
          </div>
        </section>

        <section className="card form-stack">
          <h2>Оставить новый отзыв</h2>
          {isCoursesLoading ? <LoadingState message="Загружаем доступные курсы..." /> : null}
          {isCoursesError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}
          {!isCoursesLoading && !isCoursesError && !availableCourses.length ? (
            <EmptyState message="Вы уже оставили отзывы по всем курсам, на которые записаны." />
          ) : null}

          {canCreateReview ? (
            <form className="form-stack" onSubmit={handleCreate}>
              <label className="field">
                <span className="field__label">Курс</span>
                <select
                  className="field__control"
                  value={draft.course_id}
                  onChange={(event) => setDraft((current) => ({ ...current, course_id: event.target.value }))}
                  required
                  disabled={createMutation.isPending}
                >
                  {availableCourses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>{course.title}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Комментарий</span>
                <textarea
                  id="review-comment"
                  className="field__control"
                  value={draft.comment}
                  onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
                  required
                  disabled={createMutation.isPending}
                />
              </label>

              <div className="field">
                <span className="field__label">Оценка</span>
                <InteractiveRatingStars
                  value={draft.rating}
                  onChange={(value) => setDraft((current) => ({ ...current, rating: value }))}
                  disabled={createMutation.isPending}
                />
              </div>

              <Button type="submit" disabled={!draft.course_id || createMutation.isPending}>Сохранить отзыв</Button>
            </form>
          ) : null}
        </section>
      </div>

      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};

const ReviewCard = ({
  review,
  onToast,
  onUpdated,
  onDeleted,
}: {
  review: Review;
  onToast: (toast: { type: 'success' | 'error'; message: string }) => void;
  onUpdated: () => void;
  onDeleted: () => Promise<void>;
}) => {
  const [draftComment, setDraftComment] = useState(review.comment);
  const [draftRating, setDraftRating] = useState(review.rating);

  useEffect(() => {
    setDraftComment(review.comment);
    setDraftRating(review.rating);
  }, [review.comment, review.rating]);

  const updateMutation = useMutation({
    mutationFn: () => reviewsApi.update(review.review_id, { comment: draftComment, rating: draftRating }),
    onSuccess: async () => {
      onToast({ type: 'success', message: 'Отзыв обновлён.' });
      await onUpdated();
    },
    onError: () => {
      onToast({ type: 'error', message: 'Не удалось обновить отзыв. Попробуйте ещё раз.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => reviewsApi.remove(review.review_id),
    onSuccess: async () => {
      onToast({ type: 'success', message: 'Отзыв удалён.' });
      await onDeleted();
    },
    onError: () => {
      onToast({ type: 'error', message: 'Не удалось удалить отзыв. Попробуйте ещё раз.' });
    },
  });

  const isBusy = updateMutation.isPending || deleteMutation.isPending;

  const handleDelete = () => {
    if (!window.confirm('Удалить отзыв? Это действие нельзя отменить.')) {
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <form
      className="list-item form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        updateMutation.mutate();
      }}
    >
      <div className="card__row">
        <strong>{review.course_title ? `Курс: ${review.course_title}` : 'Курс недоступен'}</strong>
        <StatusBadge status={(review.status ?? 'pending') as ReviewStatus} />
      </div>

      <div className="muted">Создан: {formatDateTime(review.created_at)} · Обновлён: {formatDateTime(review.updated_at ?? review.created_at)}</div>

      <label className="field">
        <span className="field__label">Комментарий</span>
        <textarea
          id={`comment-${review.review_id}`}
          className="field__control"
          value={draftComment}
          onChange={(event) => setDraftComment(event.target.value)}
          required
          disabled={isBusy}
        />
      </label>

      <div className="field">
        <span className="field__label">Оценка</span>
        <InteractiveRatingStars value={draftRating} onChange={setDraftRating} disabled={isBusy} />
      </div>

      <div className="card__row review-card__actions">
        <Button type="submit" variant="secondary" disabled={isBusy}>Сохранить изменения</Button>
        <Button type="button" variant="ghost" onClick={handleDelete} disabled={isBusy}>
          {deleteMutation.isPending ? 'Удаляем...' : 'Удалить отзыв'}
        </Button>
        {review.course_id ? (
          <Link to={`/courses/${review.course_id}`} className="text-link">Открыть страницу курса</Link>
        ) : null}
      </div>
    </form>
  );
};

const InteractiveRatingStars = ({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) => (
  <div className="star-rating" role="group" aria-label="Выбор рейтинга">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className={`star-rating__star ${star <= value ? 'star-rating__star--active' : ''}`}
        aria-label={`Оценка ${star}`}
        title={`Оценка ${star}`}
        onClick={() => onChange(star)}
        disabled={disabled}
      >
        ★
      </button>
    ))}
  </div>
);
