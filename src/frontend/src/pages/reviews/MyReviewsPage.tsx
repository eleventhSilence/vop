import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { reviewsApi } from '@/entities/review/api';
import type { ReviewStatus } from '@/entities/review/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

export const MyReviewsPage = () => {
  const [draft, setDraft] = useState({ course_id: '', comment: '', rating: 5 });
  const reviewsQuery = useQuery({ queryKey: ['reviews', 'my'], queryFn: reviewsApi.myReviews });
  const coursesQuery = useQuery({ queryKey: ['courses', 'my'], queryFn: coursesApi.myCourses });

  const reviews = reviewsQuery.data ? ensurePaginated(reviewsQuery.data).results : [];
  const courses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

  const reviewedCourseIds = useMemo(() => new Set(reviews.map((review) => review.course_id)), [reviews]);
  const availableCourses = courses.filter((course) => !reviewedCourseIds.has(course.course_id));

  const createMutation = useMutation({
    mutationFn: () => reviewsApi.create(draft),
    onSuccess: async () => {
      setDraft({ course_id: '', comment: '', rating: 5 });
      await Promise.all([reviewsQuery.refetch(), coursesQuery.refetch()]);
    },
  });

  const isCoursesLoading = coursesQuery.isLoading;
  const isCoursesError = coursesQuery.isError;
  const canCreateReview = !isCoursesLoading && !isCoursesError && availableCourses.length > 0;

  const handleCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateReview) {
      return;
    }
    createMutation.mutate();
  };

  return (
    <PageSection>
      <div className="details-layout">
        <form className="card form-stack" onSubmit={handleCreate}>
          <div>
            <p className="eyebrow">Отзывы</p>
            <h2>Оставить отзыв</h2>
          </div>

          {isCoursesLoading ? <LoadingState message="Загружаем доступные курсы..." /> : null}
          {isCoursesError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}
          {!isCoursesLoading && !isCoursesError && !availableCourses.length ? <EmptyState message="Нет доступных курсов для нового отзыва." /> : null}

          <label className="field">
            <span className="field__label">Курс</span>
            <select
              className="field__control"
              value={draft.course_id}
              onChange={(event) => setDraft((current) => ({ ...current, course_id: event.target.value }))}
              required
              disabled={!canCreateReview || createMutation.isPending}
            >
              <option value="">Выберите курс</option>
              {availableCourses.map((course) => (
                <option key={course.course_id} value={course.course_id}>{course.title}</option>
              ))}
            </select>
          </label>
          <Input
            id="review-comment"
            label="Комментарий"
            value={draft.comment}
            onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
            required
            disabled={!canCreateReview || createMutation.isPending}
          />
          <Input
            id="review-rating"
            label="Оценка"
            type="number"
            min={1}
            max={5}
            value={draft.rating}
            onChange={(event) => setDraft((current) => ({ ...current, rating: Number(event.target.value) }))}
            required
            disabled={!canCreateReview || createMutation.isPending}
          />
          <Button type="submit" disabled={!canCreateReview || createMutation.isPending}>Сохранить отзыв</Button>
          {createMutation.isError ? <div className="form-error">{extractApiError(createMutation.error)}</div> : null}
        </form>

        <div className="card card--wide">
          <h3>Мои отзывы</h3>
          {reviewsQuery.isLoading ? <LoadingState /> : null}
          {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
          {!reviewsQuery.isLoading && !reviews.length ? <EmptyState message="Вы ещё не оставляли отзывы." /> : null}
          <div className="stack-list">
            {reviews.map((review) => (
              <ReviewEditor
                key={review.review_id}
                reviewId={review.review_id}
                comment={review.comment}
                rating={review.rating}
                status={review.status ?? 'pending'}
                onUpdated={() => reviewsQuery.refetch()}
              />
            ))}
          </div>
        </div>
      </div>
    </PageSection>
  );
};

const ReviewEditor = ({
  reviewId,
  comment,
  rating,
  status,
  onUpdated,
}: {
  reviewId: string;
  comment: string;
  rating: number;
  status: ReviewStatus;
  onUpdated: () => void;
}) => {
  const [draftComment, setDraftComment] = useState(comment);
  const [draftRating, setDraftRating] = useState(rating);

  const updateMutation = useMutation({
    mutationFn: () => reviewsApi.update(reviewId, { comment: draftComment, rating: draftRating }),
    onSuccess: async () => {
      await onUpdated();
    },
  });

  return (
    <form className="list-item form-stack" onSubmit={(event) => {
      event.preventDefault();
      updateMutation.mutate();
    }}>
      <div className="card__row">
        <strong>Отзыв #{reviewId.slice(0, 8)}</strong>
        <StatusBadge status={status} />
      </div>
      <Input
        id={`comment-${reviewId}`}
        label="Комментарий"
        value={draftComment}
        onChange={(event) => setDraftComment(event.target.value)}
        required
        disabled={updateMutation.isPending}
      />
      <Input
        id={`rating-${reviewId}`}
        label="Оценка"
        type="number"
        min={1}
        max={5}
        value={draftRating}
        onChange={(event) => setDraftRating(Number(event.target.value))}
        required
        disabled={updateMutation.isPending}
      />
      {updateMutation.isError ? <div className="form-error">{extractApiError(updateMutation.error)}</div> : null}
      <div className="card__row">
        <Button type="submit" variant="secondary" disabled={updateMutation.isPending}>Обновить</Button>
        <Link to={`/account/reviews/${reviewId}/edit`} className="text-link">Открыть отдельную страницу →</Link>
      </div>
    </form>
  );
};
