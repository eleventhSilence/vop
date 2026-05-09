import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { authApi } from '@/shared/api/auth';
import { extractApiError } from '@/shared/api/client';
import { formatStatus } from '@/shared/lib/format';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';

export const AccountDashboardSection = () => {
  const dashboardQuery = useQuery({
    queryKey: ['account', 'dashboard'],
    queryFn: authApi.dashboard,
  });

  return (
    <section>
      <div className="section-header">
        <div>
          <p className="eyebrow">Статистика аккаунта</p>
          <h3>Обзор активности</h3>
        </div>
      </div>

      {dashboardQuery.isLoading ? <LoadingState /> : null}
      {dashboardQuery.isError ? <ErrorState message={extractApiError(dashboardQuery.error)} /> : null}

      {dashboardQuery.data ? (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span>Записан на курсы</span><strong>{dashboardQuery.data.stats.enrolled_courses_count}</strong></div>
            <div className="stat-card"><span>Завершено</span><strong>{dashboardQuery.data.stats.completed_courses_count}</strong></div>
            <div className="stat-card"><span>В процессе</span><strong>{dashboardQuery.data.stats.in_progress_courses_count}</strong></div>
          </div>

          <div className="details-layout">
            <article className="card card--wide">
              <h3>Последние курсы</h3>
              {!dashboardQuery.data.recent_courses.length ? <EmptyState message="Пока нет курсов с активным прогрессом." /> : null}
              {dashboardQuery.data.recent_courses.length ? (
                <div className="stack-list">
                  {dashboardQuery.data.recent_courses.map((course) => (
                    <div key={course.course_id} className="list-item">
                      <div className="card__row">
                        <strong>{course.title}</strong>
                        <span>{course.progress_percent}%</span>
                      </div>
                      <p>{course.short_description}</p>
                      <p className="muted">Статус: {formatStatus(course.progress_status)}</p>
                      <Link to={`/account/courses/${course.course_id}`} state={{ from: 'my-courses' }} className="text-link">Перейти к обучению →</Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="card">
              <h3>Последние отзывы</h3>
              {!dashboardQuery.data.recent_reviews.length ? <EmptyState message="Пока нет отзывов для отображения." /> : null}
              {dashboardQuery.data.recent_reviews.length ? (
                <div className="stack-list">
                  {dashboardQuery.data.recent_reviews.map((review) => (
                    <div key={review.review_id} className="list-item">
                      <strong>{review.course_title}</strong>
                      <p>{review.comment}</p>
                      <p className="muted">Статус: {formatStatus(review.status)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
};
