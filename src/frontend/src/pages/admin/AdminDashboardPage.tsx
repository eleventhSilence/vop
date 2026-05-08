import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/entities/admin/api';
import { extractApiError } from '@/shared/api/client';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminDashboardPage = () => {
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
  });

  return (
    <PageSection>
      <div className="section-header"><div><p className="eyebrow">Администрирование</p><h2>Администрирование: обзор</h2></div></div>
      {dashboardQuery.isLoading ? <LoadingState /> : null}
      {dashboardQuery.isError ? <ErrorState message={extractApiError(dashboardQuery.error)} /> : null}
      {dashboardQuery.data ? (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span>Пользователи</span><strong>{dashboardQuery.data.users.total_users}</strong></div>
            <div className="stat-card"><span>Курсы</span><strong>{dashboardQuery.data.courses.total_courses}</strong></div>
            <div className="stat-card"><span>Отзывы</span><strong>{dashboardQuery.data.reviews.total_reviews}</strong></div>
            <div className="stat-card"><span>Тесты</span><strong>{dashboardQuery.data.testing.total_tests}</strong></div>
          </div>
          <div className="details-layout">
            <div className="card card--wide">
              <h3>Последние пользователи</h3>
              <div className="stack-list">
                {dashboardQuery.data.recent_users.map((user) => (
                  <div className="list-item" key={user.user_id}>
                    <strong>{user.email}</strong>
                    <p>{user.first_name} {user.last_name}</p>
                    <p>{user.role} · {user.status}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>Отзывы на модерации</h3>
              <div className="stack-list">
                {dashboardQuery.data.pending_reviews.length ? (
                  dashboardQuery.data.pending_reviews.map((review) => (
                    <div className="list-item" key={review.review_id}>
                      <strong>{review.course_title}</strong>
                      <p>{review.user_email}</p>
                      <p>{review.comment}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState message="Сейчас нет отзывов на модерации." />
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PageSection>
  );
};
