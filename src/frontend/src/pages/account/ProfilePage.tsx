import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/shared/api/auth';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatRole, formatStatus } from '@/shared/lib/format';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const ProfilePage = () => {
  const meQuery = useQuery({
    queryKey: ['account', 'me'],
    queryFn: authApi.me,
  });

  return (
    <PageSection>
      <div className="section-header">
        <div>
          <p className="eyebrow">Аккаунт</p>
          <h2>Профиль</h2>
        </div>
      </div>

      {meQuery.isLoading ? <LoadingState /> : null}
      {meQuery.isError ? <ErrorState message={extractApiError(meQuery.error)} /> : null}

      {meQuery.data ? (
        <div className="card card--wide">
          <dl className="description-list">
            <div><dt>Имя</dt><dd>{meQuery.data.first_name}</dd></div>
            <div><dt>Фамилия</dt><dd>{meQuery.data.last_name}</dd></div>
            <div><dt>Email</dt><dd>{meQuery.data.email}</dd></div>
            <div><dt>Роль</dt><dd>{formatRole(meQuery.data.role)}</dd></div>
            <div><dt>Статус</dt><dd>{formatStatus(meQuery.data.status)}</dd></div>
            <div><dt>Дата регистрации</dt><dd>{formatDateTime(meQuery.data.registered_at)}</dd></div>
            <div><dt>Последний вход</dt><dd>{formatDateTime(meQuery.data.last_login_at)}</dd></div>
          </dl>
        </div>
      ) : null}
    </PageSection>
  );
};
