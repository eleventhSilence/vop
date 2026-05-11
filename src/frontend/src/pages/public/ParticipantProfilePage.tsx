import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { usersApi } from '@/entities/user/api';
import { formatDateTime, formatRole } from '@/shared/lib/format';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';


const renderRatingStars = (rating: number | null | undefined) => {
  const safeRating = Number.isFinite(Number(rating)) ? Math.trunc(Number(rating)) : 0;
  if (safeRating < 1 || safeRating > 5) {
    return null;
  }

  return Array.from({ length: 5 }, (_, index) => index < safeRating);
};

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
            <h3>Участник платформы</h3>
            <dl className="description-list">
              <div><dt>Имя</dt><dd>{profileQuery.data.first_name}</dd></div>
              <div><dt>Фамилия</dt><dd>{profileQuery.data.last_name}</dd></div>
              <div><dt>Роль</dt><dd>{formatRole(profileQuery.data.role)}</dd></div>
              <div><dt>На платформе с</dt><dd>{formatDateTime(profileQuery.data.date_joined)}</dd></div>
            </dl>
          </section>

          <section className="participant-profile-stats-grid">
            <article className="card participant-profile-stats-card">
              <p className="participant-profile-stats-card__label">Завершено курсов</p>
              <p className="participant-profile-stats-card__value">{profileQuery.data.completed_courses_count}</p>
            </article>
            <article className="card participant-profile-stats-card">
              <p className="participant-profile-stats-card__label">Опубликовано отзывов</p>
              <p className="participant-profile-stats-card__value">{profileQuery.data.approved_reviews_count}</p>
            </article>
          </section>

          <section className="card">
            <h3>Последние одобренные отзывы</h3>
            {!profileQuery.data.latest_reviews.length ? (
              <EmptyState message="У пользователя пока нет опубликованных отзывов." />
            ) : (
              <div className="stack-list">
                {profileQuery.data.latest_reviews.slice(0, 5).map((review) => {
                  const stars = renderRatingStars(review.rating);

                  return (
                    <article key={review.id} className="list-item public-review-item">
                      <div className="card__row">
                        <p className="public-participant-review-course">
                          <span className="muted">Название курса:</span>{' '}
                          <strong>{review.course_title || '—'}</strong>
                        </p>
                        <span className="muted">{formatDateTime(review.created_at)}</span>
                      </div>
                      <p className="public-participant-review-rating muted">
                        <span>Оценка:</span>{' '}
                        {stars ? (
                          <span className="public-participant-review-stars" aria-label={`Оценка ${review.rating} из 5`}>
                            {stars.map((isActive, index) => (
                              <span
                                key={`${review.id}-star-${index + 1}`}
                                className={isActive ? 'public-participant-review-star--active' : 'public-participant-review-star--inactive'}
                              >
                                ★
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </p>
                      <p>{review.text}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </PageSection>
  );
};
