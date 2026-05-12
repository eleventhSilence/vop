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
import { RatingStars } from '@/shared/ui/RatingStars';
import { Toast } from '@/shared/ui/Toast';

export const MyReviewsPage = () => {
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
  const coursesWithoutReview = useMemo(
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

  return (
    <PageSection>
      <div className="form-stack">
        <header className="section-header">
          <p className="eyebrow">ОТЗЫВЫ</p>
          <h1>Мои отзывы</h1>
        </header>

        <section className="card form-stack reviews-card">
          <h2>Курсы без отзыва</h2>
          {coursesQuery.isLoading ? <LoadingState message="Загружаем доступные курсы..." /> : null}
          {coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}

          {!coursesQuery.isLoading && !coursesQuery.isError && coursesWithoutReview.length > 0 ? (
            <>
              <p className="muted">Вы ещё не оставили отзыв по следующим курсам:</p>
              <div className="stack-list">
                {coursesWithoutReview.map((course) => (
                  <div key={course.course_id} className="course-item">
                    <span className="course-title">{course.title}</span>
                    <Link to={`/account/courses/${course.course_id}/learn#review`} className="review-btn">
                      Оставить отзыв
                    </Link>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {!coursesQuery.isLoading && !coursesQuery.isError && coursesWithoutReview.length === 0 ? (
            <EmptyState message="Вы уже оставили отзывы по всем курсам, на которые записаны." />
          ) : null}
        </section>

        <section className="card form-stack reviews-card">
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
      </div>

      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};

const ReviewCard = ({ review, onToast, onUpdated, onDeleted }: {
  review: Review;
  onToast: (toast: { type: 'success' | 'error'; message: string }) => void;
  onUpdated: () => void;
  onDeleted: () => Promise<void>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
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
      setIsEditing(false);
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

  const status = (review.status ?? 'pending') as ReviewStatus;
  const statusLabel = status === 'approved' ? 'Опубликован' : status === 'rejected' ? 'Отклонён' : 'На модерации';
  const isApprovedStatus = status === 'approved';

  const handleDelete = () => {
    if (!window.confirm('Удалить отзыв? Это действие нельзя отменить.')) {
      return;
    }
    deleteMutation.mutate();
  };

  const handleEditCancel = () => {
    setDraftComment(review.comment);
    setDraftRating(review.rating);
    setIsEditing(false);
  };

  const resolvedCourseTitle = review.course_title?.trim() || review.course?.title?.trim() || review.course?.name?.trim();
  const isCourseAvailable = review.course_is_available ?? (review.course?.status ? review.course.status === 'available' : true);
  const shouldShowUnavailable = !resolvedCourseTitle && (isCourseAvailable === false || !review.course_id);

  return (
    <article className="review-item form-stack">
      <div className="review-header">
        <strong>
          {resolvedCourseTitle ? (
            review.course_id && isCourseAvailable !== false ? (
              <Link to={`/courses/${review.course_id}`} className="course-title">{resolvedCourseTitle}</Link>
            ) : (
              resolvedCourseTitle
            )
          ) : shouldShowUnavailable ? (
            'Курс недоступен'
          ) : (
            'Курс'
          )}
        </strong>
        <span className={`status-badge ${isApprovedStatus ? 'approved' : ''}`}>{statusLabel}</span>
      </div>

      <p className="review-date">Создан: {formatDateTime(review.created_at)} · Обновлён: {formatDateTime(review.updated_at ?? review.created_at)}</p>

      {isEditing ? (
        <form
          className="form-stack"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            updateMutation.mutate();
          }}
        >
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
            <span className="field__label review-rating-label">Оценка</span>
            <InteractiveRatingStars value={draftRating} onChange={setDraftRating} disabled={isBusy} />
          </div>

          <div className="review-actions">
            <Button type="submit" variant="secondary" className="secondary-btn" disabled={isBusy}>Сохранить</Button>
            <Button type="button" variant="ghost" className="danger-btn" onClick={handleEditCancel} disabled={isBusy}>Отмена</Button>
          </div>
        </form>
      ) : (
        <>
          <div className="field">
            <span className="field__label review-rating-label">Оценка</span>
            <RatingStars rating={review.rating} ariaLabel="Оценка отзыва" className="rating" />
          </div>
          <p className="review-text">{review.comment}</p>
          <div className="review-actions">
            <Button type="button" variant="secondary" className="secondary-btn" onClick={() => setIsEditing(true)} disabled={isBusy}>Редактировать</Button>
            <Button type="button" variant="ghost" className="danger-btn" onClick={handleDelete} disabled={isBusy}>
              {deleteMutation.isPending ? 'Удаляем...' : 'Удалить'}
            </Button>
          </div>
        </>
      )}
    </article>
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
