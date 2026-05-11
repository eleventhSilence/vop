import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { usersApi } from '@/entities/user/api';
import { formatDateTime, formatRole } from '@/shared/lib/format';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const ParticipantProfilePage = () => {
  const { userId = '' } = useParams();

  const profileQuery = useQuery({
    queryKey: ['participants', userId],
    queryFn: () => usersApi.getPublicUserProfile(userId),
    enabled: Boolean(userId),
  });

  return (
    <PageSection className="public-page-stack participant-profile-page">
      {profileQuery.isLoading ? <LoadingState message="Загрузка профиля..." /> : null}

      {profileQuery.isError ? (
        <div className="card">
          <h3>Профиль не найден</h3>
          <p className="muted">Проверьте ссылку или вернитесь в каталог курсов.</p>
        </div>
      ) : null}

      {profileQuery.data ? (
        <>
          <Link to="/courses" className="button button--ghost public-course-details-back-link">
            ← К каталогу курсов
          </Link>

          <section className="card">
            <p className="eyebrow">УЧАСТНИК ПЛАТФОРМЫ</p>
            <h2>{profileQuery.data.first_name} {profileQuery.data.last_name}</h2>
          </section>

          <section className="card">
            <h3>Профиль</h3>
            <dl className="description-list">
              <div><dt>Имя</dt><dd>{profileQuery.data.first_name}</dd></div>
              <div><dt>Фамилия</dt><dd>{profileQuery.data.last_name}</dd></div>
              <div><dt>Роль</dt><dd>{formatRole(profileQuery.data.role)}</dd></div>
              <div><dt>На платформе с</dt><dd>{formatDateTime(profileQuery.data.date_joined)}</dd></div>
            </dl>
          </section>

          <section className="participant-profile-stats-grid">
            <article className="card">
              <p className="eyebrow">Статистика</p>
              <h3>Завершено курсов</h3>
              <p className="lead">{profileQuery.data.completed_courses_count}</p>
            </article>
            <article className="card">
              <p className="eyebrow">Статистика</p>
              <h3>Опубликовано отзывов</h3>
              <p className="lead">{profileQuery.data.approved_reviews_count}</p>
            </article>
          </section>

          <section className="card">
            <h3>Последние одобренные отзывы</h3>
            {!profileQuery.data.latest_reviews.length ? (
              <EmptyState message="У пользователя пока нет опубликованных отзывов." />
            ) : (
              <div className="stack-list">
                {profileQuery.data.latest_reviews.slice(0, 5).map((review) => (
                  <article key={review.id} className="list-item public-review-item">
                    <div className="card__row">
                      <strong>{review.course_title}</strong>
                      <span className="muted">{formatDateTime(review.created_at)}</span>
                    </div>
                    <p className="muted">Оценка: {review.rating}/5</p>
                    <p>{review.text}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </PageSection>
  );
};
