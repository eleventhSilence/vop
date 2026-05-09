import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import type { CourseEnrollment, EnrolledCourse } from '@/entities/course/types';
import { reviewsApi } from '@/entities/review/api';
import type { Review } from '@/entities/review/types';
import { useAuth } from '@/features/auth/model/useAuth';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatStatus } from '@/shared/lib/format';
import { ensurePaginated, type PaginatedResponse } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

const ENROLL_PENDING_TEXT = 'Оформляем запись...';
const ENROLL_SUCCESS_TEXT = 'Запись оформлена. Курс уже доступен в личном кабинете.';

const toEnrolledCourse = (
  enrollment: CourseEnrollment,
  fallback: { title: string; short_description: string },
): EnrolledCourse => ({
  course_id: enrollment.course_id,
  title: fallback.title,
  short_description: fallback.short_description,
  enrolled_at: enrollment.enrolled_at,
  is_theory_completed: enrollment.is_theory_completed,
  progress_percent: 0,
  progress_status: enrollment.progress_status,
  is_test_passed: false,
});

export const CourseDetailPage = () => {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
  const { isAuthenticated, isAdmin } = useAuth();
  const [selectedRating, setSelectedRating] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsItems, setReviewsItems] = useState<Review[]>([]);
  const [reviewsNext, setReviewsNext] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ['courses', 'detail', courseId],
    queryFn: () => coursesApi.detail(courseId),
    enabled: Boolean(courseId),
  });

  const reviewsQuery = useQuery<PaginatedResponse<Review>, Error>({
    queryKey: ['courses', 'reviews', courseId, selectedRating, reviewsPage],
    queryFn: () =>
      reviewsApi.listByCourse(courseId, {
        page: reviewsPage,
        page_size: 10,
        rating: selectedRating,
      }),
    enabled: Boolean(courseId),
  });

  useEffect(() => {
    const data = reviewsQuery.data;
    if (!data) {
      return;
    }

    setReviewsNext(data.next);
    if (reviewsPage === 1) {
      setReviewsItems(data.results);
      return;
    }

    setReviewsItems((current) => [...current, ...data.results]);
  }, [reviewsPage, reviewsQuery.data]);

  const myCoursesQuery = useQuery({
    queryKey: ['courses', 'my'],
    queryFn: coursesApi.myCourses,
    enabled: isAuthenticated,
  });

  const enrollMutation = useMutation({
    mutationFn: () => coursesApi.enroll(courseId),
    onSuccess: async (enrollment) => {
      const fallbackCourse = courseQuery.data;
      queryClient.setQueryData<PaginatedResponse<EnrolledCourse> | EnrolledCourse[] | undefined>(
        ['courses', 'my'],
        (current) => {
          const nextEnrolled = toEnrolledCourse(enrollment, {
            title: fallbackCourse?.title ?? 'Курс',
            short_description: fallbackCourse?.short_description ?? '',
          });

          if (!current) {
            return {
              count: 1,
              next: null,
              previous: null,
              results: [nextEnrolled],
            };
          }

          if (Array.isArray(current)) {
            if (current.some((course) => course.course_id === nextEnrolled.course_id)) {
              return current;
            }
            return [nextEnrolled, ...current];
          }

          if (current.results.some((course) => course.course_id === nextEnrolled.course_id)) {
            return current;
          }

          return {
            ...current,
            count: current.count + 1,
            results: [nextEnrolled, ...current.results],
          };
        },
      );

      await queryClient.invalidateQueries({ queryKey: ['courses', 'my'] });
    },
  });

  const hasNextReviewsPage = Boolean(reviewsNext);
  const myCourses = myCoursesQuery.data ? ensurePaginated(myCoursesQuery.data).results : [];
  const enrolledCourse = myCourses.find((course) => course.course_id === courseId);
  const isCourseAvailable = courseQuery.data?.status === 'available';
  const isEnrolled = Boolean(enrolledCourse || enrollMutation.isSuccess);
  const enrolledProgressPercent = enrolledCourse?.progress_percent ?? 25;
  const enrolledProgressStatus = enrolledCourse?.progress_status ?? 'enrolled';
  const mainStatusLabel = isEnrolled ? 'Вы записаны' : 'Доступен';
  const progressLabel = !isEnrolled
    ? 'Не записан на курс'
    : enrolledCourse?.progress_percent === 50
      ? 'Теория завершена'
      : enrolledCourse?.progress_percent === 75
        ? 'На тестировании'
        : enrolledCourse?.progress_percent === 100
          ? 'Курс завершён'
          : 'Записан на курс';

  return (
    <PageSection className="public-page-stack">
      {courseQuery.isLoading ? <LoadingState message="Загружаем информацию о курсе..." /> : null}
      {courseQuery.isError ? <ErrorState message={extractApiError(courseQuery.error)} /> : null}

      {courseQuery.data ? (
        <>
          <Link to="/courses" className="button button--ghost public-course-details-back-link">
            ← К каталогу
          </Link>

          <div className="details-layout public-course-details-layout">
          <article className="card card--wide public-course-details-card">
            <div className="card__row public-course-details-card__heading">
              <div>
                <p className="eyebrow">Публичная страница курса</p>
                <h2>{courseQuery.data.title}</h2>
              </div>
              <StatusBadge
                status={isEnrolled ? 'enrolled' : 'available'}
                label={mainStatusLabel}
                tone={isEnrolled ? 'accent' : 'success'}
              />
            </div>

            <p className="lead">{courseQuery.data.short_description}</p>

            <div className="card public-course-cta-card">
              <div>
                <p className="eyebrow">Действие по курсу</p>
                <h3>{!isAuthenticated || isEnrolled ? 'Можно продолжить обучение' : 'Готово к записи'}</h3>
                <p className="muted">
                  {!isAuthenticated
                    ? 'Авторизуйтесь, чтобы записаться и продолжить обучение в личном кабинете.'
                    : isAdmin
                      ? isEnrolled
                        ? `Статус: Записан. Прогресс: ${enrolledCourse?.progress_percent ?? 25}%.`
                        : 'Вы вошли как администратор. Можно записаться на курс или перейти в панель управления.'
                    : isEnrolled
                      ? `Статус: ${formatStatus(enrolledProgressStatus)}. Прогресс: ${enrolledProgressPercent}%.`
                      : isCourseAvailable
                        ? 'После записи курс появится в разделе «Мои курсы».'
                        : 'Сейчас запись на курс недоступна.'}
                </p>
              </div>

              <div className="hero-card__actions public-course-cta-card__actions">
                {!isAuthenticated ? (
                  <Link to="/login" state={{ from: { pathname: `/courses/${courseId}` } }} className="button button--primary">
                    Войти, чтобы записаться
                  </Link>
                ) : isAdmin ? (
                  <>
                    {isEnrolled ? (
                      <Link to={`/account/courses/${courseId}`} className="button button--primary">
                        Перейти к обучению
                      </Link>
                    ) : (
                      <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending || !isCourseAvailable}>
                        {enrollMutation.isPending ? ENROLL_PENDING_TEXT : 'Записаться на курс'}
                      </Button>
                    )}
                    <Link to="/admin/courses" className="button button--ghost">
                      Перейти в админ-панель
                    </Link>
                  </>
                ) : enrollMutation.isSuccess ? (
                  <>
                    <Link to={`/account/courses/${courseId}`} className="button button--primary">
                      Перейти к обучению
                    </Link>
                    <Link to="/account/courses" className="button button--ghost">
                      Перейти в мои курсы
                    </Link>
                  </>
                ) : enrolledCourse ? (
                  <Link to={`/account/courses/${courseId}`} className="button button--primary">
                    Перейти к обучению
                  </Link>
                ) : (
                  <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending || !isCourseAvailable}>
                    {enrollMutation.isPending ? ENROLL_PENDING_TEXT : 'Записаться на курс'}
                  </Button>
                )}
              </div>

              {enrollMutation.isError ? <ErrorState message={`Не удалось оформить запись: ${extractApiError(enrollMutation.error)}`} /> : null}
              {enrollMutation.isSuccess ? <SuccessState message={ENROLL_SUCCESS_TEXT} /> : null}
            </div>
          </article>

          <aside className="stack-list public-course-sidebar">
            <section className="card">
              <h3>Краткая информация</h3>
              <dl className="description-list">
                <div>
                  <dt>Прогресс</dt>
                  <dd>{progressLabel}</dd>
                </div>
                <div>
                  <dt>Обновлён</dt>
                  <dd>{formatDateTime(courseQuery.data.updated_at)}</dd>
                </div>
                <div>
                  <dt>Участники</dt>
                  <dd>{courseQuery.data.participants_count}</dd>
                </div>
                <div>
                  <dt>Отзывы</dt>
                  <dd>{courseQuery.data.review_count ?? reviewsQuery.data?.count ?? reviewsItems.length}</dd>
                </div>
              </dl>
            </section>
          </aside>
          </div>

          <section className="card public-course-reviews-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">Отзывы</p>
                <h3>Одобренные отзывы участников</h3>
              </div>
              <label className="public-reviews-filter">
                <span>Оценка:</span>
                <select
                  value={selectedRating}
                  onChange={(event) => {
                    setSelectedRating(event.target.value as 'all' | '1' | '2' | '3' | '4' | '5');
                    setReviewsItems([]);
                    setReviewsNext(null);
                    setReviewsPage(1);
                  }}
                >
                  <option value="all">Все оценки</option>
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </label>
            </div>
            {reviewsQuery.isLoading ? <LoadingState message="Загружаем отзывы..." /> : null}
            {reviewsQuery.isError ? <ErrorState message={extractApiError(reviewsQuery.error)} /> : null}
            {!reviewsQuery.isLoading && !reviewsQuery.isError && !reviewsItems.length ? (
              <EmptyState
                message={
                  selectedRating === 'all'
                    ? 'Пока нет одобренных отзывов по этому курсу.'
                    : 'Отзывов с выбранной оценкой пока нет.'
                }
              />
            ) : null}
            <div className="stack-list">
              {reviewsItems.map((review) => (
                <div key={review.review_id} className="list-item public-review-item">
                  <div className="card__row">
                    <strong>Оценка: {review.rating}/5</strong>
                    <span className="muted">{formatDateTime(review.created_at)}</span>
                  </div>
                  <p className="muted">Автор: {review.author_name ?? 'Участник курса'}</p>
                  <p>{review.comment}</p>
                </div>
              ))}
            </div>
            {hasNextReviewsPage ? (
              <div className="public-reviews-more">
                <Button onClick={() => setReviewsPage((current) => current + 1)} disabled={reviewsQuery.isFetching}>
                  {reviewsQuery.isFetching ? 'Загрузка...' : 'Показать ещё'}
                </Button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </PageSection>
  );
};
