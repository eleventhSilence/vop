import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { reviewsApi } from '@/entities/review/api';
import { useAuth } from '@/features/auth/model/AuthContext';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

export const CourseDetailPage = () => {
  const { courseId = '' } = useParams();
  const { isAuthenticated } = useAuth();

  const courseQuery = useQuery({
    queryKey: ['courses', 'detail', courseId],
    queryFn: () => coursesApi.detail(courseId),
    enabled: Boolean(courseId),
  });

  const reviewsQuery = useQuery({
    queryKey: ['courses', 'reviews', courseId],
    queryFn: () => reviewsApi.listByCourse(courseId),
    enabled: Boolean(courseId),
  });

  const enrollMutation = useMutation({
    mutationFn: () => coursesApi.enroll(courseId),
  });

  const reviews = reviewsQuery.data ? ensurePaginated(reviewsQuery.data).results : [];

  return (
    <PageSection>
      {courseQuery.isLoading ? <LoadingState /> : null}
      {courseQuery.isError ? <ErrorState message={extractApiError(courseQuery.error)} /> : null}

      {courseQuery.data ? (
        <div className="details-layout">
          <article className="card card--wide">
            <div className="card__row">
              <h2>{courseQuery.data.title}</h2>
              <StatusBadge status={courseQuery.data.status} />
            </div>
            <p className="lead">{courseQuery.data.short_description}</p>
            <div className="prose-block">{courseQuery.data.content}</div>
            {isAuthenticated ? (
              <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
                {enrollMutation.isPending ? 'Записываем...' : 'Записаться на курс'}
              </Button>
            ) : (
              <p className="muted">Чтобы записаться, нужно войти в систему.</p>
            )}
            {enrollMutation.isError ? <div className="form-error">{extractApiError(enrollMutation.error)}</div> : null}
            {enrollMutation.isSuccess ? <div className="form-success">Вы записаны на курс.</div> : null}
          </article>

          <aside className="card">
            <h3>Отзывы студентов</h3>
            {reviewsQuery.isLoading ? <LoadingState message="Загружаем отзывы..." /> : null}
            {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
            {!reviewsQuery.isLoading && !reviews.length ? <EmptyState message="Пока нет одобренных отзывов." /> : null}
            <div className="stack-list">
              {reviews.map((review) => (
                <div key={review.review_id} className="list-item">
                  <strong>Оценка: {review.rating}/5</strong>
                  <p>{review.comment}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </PageSection>
  );
};
