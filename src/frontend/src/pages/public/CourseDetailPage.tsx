import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { reviewsApi } from '@/entities/review/api';
import { useAuth } from '@/features/auth/model/AuthContext';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

const getContentBlocks = (content: string) => {
  return content
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);
};

export const CourseDetailPage = () => {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
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

  const myCoursesQuery = useQuery({
    queryKey: ['courses', 'my'],
    queryFn: coursesApi.myCourses,
    enabled: isAuthenticated,
  });

  const enrollMutation = useMutation({
    mutationFn: () => coursesApi.enroll(courseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['courses', 'my'] });
    },
  });

  const reviews = reviewsQuery.data ? ensurePaginated(reviewsQuery.data).results : [];
  const myCourses = myCoursesQuery.data ? ensurePaginated(myCoursesQuery.data).results : [];
  const enrolledCourse = myCourses.find((course) => course.course_id === courseId);
  const contentBlocks = courseQuery.data ? getContentBlocks(courseQuery.data.content) : [];
  const isCourseAvailable = courseQuery.data?.status === 'available';

  return (
    <PageSection className="public-page-stack">
      {courseQuery.isLoading ? <LoadingState message="Загружаем информацию о курсе..." /> : null}
      {courseQuery.isError ? <ErrorState message={extractApiError(courseQuery.error)} /> : null}

      {courseQuery.data ? (
        <div className="details-layout public-course-details-layout">
          <article className="card card--wide public-course-details-card">
            <div className="card__row public-course-details-card__heading">
              <div>
                <p className="eyebrow">Публичная страница курса</p>
                <h2>{courseQuery.data.title}</h2>
              </div>
              <StatusBadge
                status={courseQuery.data.status}
                tone={isCourseAvailable ? 'success' : 'neutral'}
              />
            </div>

            <p className="lead">{courseQuery.data.short_description}</p>

            <div className="card public-course-cta-card">
              <div>
                <p className="eyebrow">Действие по курсу</p>
                <h3>{enrolledCourse ? 'Можно продолжить обучение' : 'Готово к записи и дальнейшему прохождению'}</h3>
                <p className="muted">
                  {!isAuthenticated
                    ? 'Для записи на курс и перехода в учебный контур необходимо авторизоваться.'
                    : enrolledCourse
                      ? `Текущий статус: ${formatStatus(enrolledCourse.progress_status)}. Прогресс: ${enrolledCourse.progress_percent}%.`
                      : isCourseAvailable
                        ? 'После записи курс появится в личном кабинете и будет доступен для дальнейшего обучения.'
                        : 'Курс временно недоступен для новой записи, но его описание и структура уже открыты для просмотра.'}
                </p>
              </div>

              <div className="hero-card__actions">
                {!isAuthenticated ? (
                  <Link to="/login" className="button button--primary">
                    Войти, чтобы записаться
                  </Link>
                ) : enrolledCourse ? (
                  <>
                    <Link to={`/account/courses/${courseId}`} className="button button--primary">
                      Перейти к обучению
                    </Link>
                    <Link to={`/account/courses/${courseId}/test`} className="button button--ghost">
                      Открыть тестирование
                    </Link>
                  </>
                ) : (
                  <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending || !isCourseAvailable}>
                    {enrollMutation.isPending ? 'Записываем...' : 'Записаться на курс'}
                  </Button>
                )}
              </div>

              {enrollMutation.isError ? <div className="form-error">{extractApiError(enrollMutation.error)}</div> : null}
              {enrollMutation.isSuccess ? <div className="form-success">Вы записаны на курс. Теперь можно перейти к обучению из личного кабинета.</div> : null}
            </div>

            <section className="public-course-content">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Содержание курса</p>
                  <h3>Описание и материалы</h3>
                </div>
              </div>

              {contentBlocks.length ? (
                <div className="prose-block public-prose-stack">
                  {contentBlocks.map((block) => (
                    <p key={block}>{block}</p>
                  ))}
                </div>
              ) : (
                <EmptyState message="Подробное содержание курса пока не заполнено." />
              )}
            </section>
          </article>

          <aside className="stack-list public-course-sidebar">
            <section className="card">
              <h3>Краткая информация</h3>
              <dl className="description-list">
                <div>
                  <dt>Статус</dt>
                  <dd>{formatStatus(courseQuery.data.status)}</dd>
                </div>
                <div>
                  <dt>Обновлён</dt>
                  <dd>{formatDateTime(courseQuery.data.updated_at)}</dd>
                </div>
                <div>
                  <dt>Отзывы</dt>
                  <dd>{reviews.length}</dd>
                </div>
                <div>
                  <dt>Формат доступа</dt>
                  <dd>Открытое описание + обучение после записи</dd>
                </div>
              </dl>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Отзывы</p>
                  <h3>Одобренные отзывы участников</h3>
                </div>
              </div>
              {reviewsQuery.isLoading ? <LoadingState message="Загружаем отзывы..." /> : null}
              {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
              {!reviewsQuery.isLoading && !reviews.length ? <EmptyState message="Пока нет одобренных отзывов по этому курсу." /> : null}
              <div className="stack-list">
                {reviews.map((review) => (
                  <div key={review.review_id} className="list-item public-review-item">
                    <div className="card__row">
                      <strong>Оценка: {review.rating}/5</strong>
                      <span className="muted">{formatDateTime(review.created_at)}</span>
                    </div>
                    <p>{review.comment}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </PageSection>
  );
};
