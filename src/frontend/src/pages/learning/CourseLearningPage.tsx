import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { reviewsApi } from '@/entities/review/api';
import { progressApi } from '@/entities/progress/api';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { CourseContentRenderer } from '@/entities/course/CourseContentRenderer';

export const CourseLearningPage = () => {
  const { courseId = '' } = useParams();
  const courseQuery = useQuery({
    queryKey: ['courses', 'my-detail', courseId],
    queryFn: () => coursesApi.myDetail(courseId),
    enabled: Boolean(courseId),
  });
  const progressQuery = useQuery({
    queryKey: ['progress', 'course', courseId],
    queryFn: () => progressApi.courseProgress(courseId),
    enabled: Boolean(courseId),
  });
  const myReviewsQuery = useQuery({
    queryKey: ['reviews', 'my'],
    queryFn: reviewsApi.myReviews,
    enabled: Boolean(courseId),
  });

  const myCourseReview = useMemo(() => {
    if (!myReviewsQuery.data) {
      return undefined;
    }
    return ensurePaginated(myReviewsQuery.data).results.find((review) => review.course_id === courseId);
  }, [courseId, myReviewsQuery.data]);

  const [reviewDraft, setReviewDraft] = useState({ comment: '', rating: 5 });

  useEffect(() => {
    if (myCourseReview) {
      setReviewDraft({ comment: myCourseReview.comment, rating: myCourseReview.rating });
      return;
    }
    setReviewDraft({ comment: '', rating: 5 });
  }, [myCourseReview]);

  const completeTheoryMutation = useMutation({
    mutationFn: () => progressApi.completeTheory(courseId),
    onSuccess: async () => {
      await progressQuery.refetch();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!courseId) {
        throw new Error('Не удалось определить курс для отзыва.');
      }

      if (myCourseReview) {
        return reviewsApi.update(myCourseReview.review_id, reviewDraft);
      }

      return reviewsApi.create({
        course_id: courseId,
        comment: reviewDraft.comment,
        rating: reviewDraft.rating,
      });
    },
    onSuccess: async (updatedReview) => {
      setReviewDraft({ comment: updatedReview.comment, rating: updatedReview.rating });
      await myReviewsQuery.refetch();
    },
  });

  const handleReviewSubmit = (event: FormEvent) => {
    event.preventDefault();
    reviewMutation.mutate();
  };

  const pageError = courseQuery.isError ? courseQuery.error : progressQuery.isError ? progressQuery.error : null;

  return (
    <PageSection>
      {(courseQuery.isLoading || progressQuery.isLoading) ? <LoadingState message="Загружаем учебные материалы..." /> : null}
      {pageError ? <ErrorState message={extractApiError(pageError)} /> : null}
      {courseQuery.data && progressQuery.data ? (
        <div className="details-layout">
          <article className="card card--wide">
            <h2>{courseQuery.data.title}</h2>
            <p className="lead">{courseQuery.data.short_description}</p>
            <CourseContentRenderer content={courseQuery.data.content} media={courseQuery.data.media} />
          </article>
          <aside className="card form-stack">
            <h3>Прогресс</h3>
            <p>Статус: {formatStatus(progressQuery.data.progress_status)}</p>
            <p>Выполнено: {progressQuery.data.progress_percent}%</p>
            <p>Теория завершена: {progressQuery.data.is_theory_completed ? 'Да' : 'Нет'}</p>
            <p>Дата завершения теории: {formatDateTime(progressQuery.data.theory_completed_at)}</p>
            <p>Попыток теста: {progressQuery.data.total_attempts}</p>
            <Button onClick={() => completeTheoryMutation.mutate()} disabled={completeTheoryMutation.isPending || progressQuery.data.is_theory_completed} fullWidth>
              {progressQuery.data.is_theory_completed ? 'Теория отмечена как завершённая' : 'Завершить теорию'}
            </Button>
            {completeTheoryMutation.isError ? <ErrorState message={extractApiError(completeTheoryMutation.error)} /> : null}
            {completeTheoryMutation.isSuccess ? <SuccessState message="Теория отмечена как завершённая. Прогресс курса обновлён." /> : null}
            <Link to={`/account/courses/${courseId}/test`} className="text-link">Перейти к тестированию →</Link>

            <hr />
            <div>
              <h3>{myCourseReview ? 'Ваш отзыв по курсу' : 'Оставить отзыв по курсу'}</h3>
              <p className="muted">Напишите отзыв сразу после прохождения теории или завершения курса.</p>
            </div>

            {myReviewsQuery.isLoading ? <LoadingState message="Загружаем ваш отзыв..." /> : null}
            {myReviewsQuery.isError ? <ErrorState message={extractApiError(myReviewsQuery.error)} /> : null}

            {!myReviewsQuery.isLoading && !myReviewsQuery.isError ? (
              <form className="form-stack" onSubmit={handleReviewSubmit}>
                <Input
                  id="course-review-comment"
                  label="Комментарий"
                  value={reviewDraft.comment}
                  onChange={(event) => setReviewDraft((current) => ({ ...current, comment: event.target.value }))}
                  required
                  disabled={reviewMutation.isPending}
                />
                <Input
                  id="course-review-rating"
                  label="Оценка"
                  type="number"
                  min={1}
                  max={5}
                  value={reviewDraft.rating}
                  onChange={(event) => setReviewDraft((current) => ({ ...current, rating: Number(event.target.value) }))}
                  required
                  disabled={reviewMutation.isPending}
                />
                <Button type="submit" disabled={reviewMutation.isPending} fullWidth>
                  {myCourseReview ? 'Обновить отзыв' : 'Оставить отзыв'}
                </Button>
                {reviewMutation.isError ? <ErrorState message={extractApiError(reviewMutation.error)} /> : null}
                {reviewMutation.isSuccess ? <SuccessState message="Отзыв сохранён. После модерации он появится на публичной странице курса." /> : null}
                {!myCourseReview ? <EmptyState message="Вы ещё не оставляли отзыв по этому курсу." /> : null}
                {myCourseReview ? <Link to={`/account/reviews/${myCourseReview.review_id}/edit`} className="text-link">Открыть отдельную страницу редактирования →</Link> : null}
              </form>
            ) : null}
          </aside>
        </div>
      ) : null}
    </PageSection>
  );
};
