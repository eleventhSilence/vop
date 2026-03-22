import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/entities/admin/api';
import { extractApiError } from '@/shared/api/client';
import { formatRole, formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminUsersPage = () => {
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: () => adminApi.users() });
  const users = usersQuery.data ? ensurePaginated(usersQuery.data).results : [];

  return (
    <PageSection>
      <h2>Администратор: пользователи</h2>
      {usersQuery.isLoading ? <LoadingState /> : null}
      {usersQuery.isError ? <ErrorState message={extractApiError(usersQuery.error)} /> : null}
      <div className="table-card">
        <table>
          <thead><tr><th>Email</th><th>Имя</th><th>Роль</th><th>Статус</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.user_id}><td>{user.email}</td><td>{user.first_name} {user.last_name}</td><td>{formatRole(user.role)}</td><td>{formatStatus(user.status)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageSection>
  );
};
