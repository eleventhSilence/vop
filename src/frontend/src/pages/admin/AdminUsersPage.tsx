import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/entities/admin/api';
import type { AdminUser, AdminUserUpdatePayload } from '@/entities/admin/types';
import { useAuth } from '@/features/auth/model/AuthContext';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatRole, formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

type EditableName = {
  first_name: string;
  last_name: string;
};

const ROLE_OPTIONS: Array<AdminUser['role']> = ['USER', 'ADMIN'];
const STATUS_OPTIONS: Array<AdminUser['status']> = ['ACTIVE', 'BLOCKED'];

export const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, EditableName>>({});

  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: () => adminApi.users() });
  const users = usersQuery.data ? ensurePaginated(usersQuery.data).results : [];
  const selectedUser = useMemo(
    () => users.find((user) => user.user_id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }

    setSelectedUserId((current) => {
      if (current && users.some((user) => user.user_id === current)) {
        return current;
      }

      return users[0].user_id;
    });
  }, [users]);

  useEffect(() => {
    if (!users.length) {
      setNameDrafts({});
      return;
    }

    setNameDrafts(
      Object.fromEntries(
        users.map((user) => [
          user.user_id,
          {
            first_name: user.first_name,
            last_name: user.last_name,
          },
        ]),
      ),
    );
  }, [users]);

  const detailsQuery = useQuery({
    queryKey: ['admin', 'users', selectedUserId],
    queryFn: () => adminApi.userDetail(selectedUserId!),
    enabled: Boolean(selectedUserId),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminUserUpdatePayload }) => adminApi.updateUser(userId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users', variables.userId], exact: true }),
      ]);
      setEditingUserId(null);
    },
  });

  const pendingUserId = updateUserMutation.variables?.userId ?? null;

  const startEditing = (user: AdminUser) => {
    setEditingUserId(user.user_id);
    setNameDrafts((current) => ({
      ...current,
      [user.user_id]: {
        first_name: user.first_name,
        last_name: user.last_name,
      },
    }));
  };

  const cancelEditing = (user: AdminUser) => {
    setEditingUserId((current) => (current === user.user_id ? null : current));
    setNameDrafts((current) => ({
      ...current,
      [user.user_id]: {
        first_name: user.first_name,
        last_name: user.last_name,
      },
    }));
  };

  const updateDraft = (userId: string, field: keyof EditableName, value: string) => {
    setNameDrafts((current) => ({
      ...current,
      [userId]: {
        first_name: current[userId]?.first_name ?? '',
        last_name: current[userId]?.last_name ?? '',
        [field]: value,
      },
    }));
  };

  const handleNameSave = (user: AdminUser) => {
    const draft = nameDrafts[user.user_id];

    if (!draft) {
      return;
    }

    const payload: AdminUserUpdatePayload = {
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
    };

    updateUserMutation.mutate({ userId: user.user_id, payload });
  };

  const getSelfLocked = (userId: string) => currentUser?.user_id === userId;
  const getRoleTone = (role: string) => (role === 'ADMIN' ? 'accent' : 'neutral');
  const getStatusTone = (status: string) => (status === 'ACTIVE' ? 'success' : 'danger');

  return (
    <PageSection>
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Пользователи</h2>
          <p className="muted">
            Управляйте ролями, статусами и именами через существующий admin API без перезагрузки страницы.
          </p>
        </div>
      </div>
      {usersQuery.isLoading ? <LoadingState /> : null}
      {usersQuery.isError ? <ErrorState message={extractApiError(usersQuery.error)} /> : null}
      {updateUserMutation.isError ? <ErrorState message={extractApiError(updateUserMutation.error)} /> : null}
      {!usersQuery.isLoading && !users.length ? <EmptyState message="Пользователи не найдены." /> : null}
      <div className="table-card">
        <div className="table-card__header">
          <div>
            <strong>Всего на странице: {users.length}</strong>
            <p className="muted">API уже возвращает пагинированный ответ, поэтому выводим текущую страницу списка.</p>
          </div>
        </div>
        <table className="users-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Дата регистрации</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.user_id}>
                <td>
                  {editingUserId === user.user_id ? (
                    <div className="inline-edit">
                      <input
                        className="field__control"
                        value={nameDrafts[user.user_id]?.first_name ?? ''}
                        onChange={(event) => updateDraft(user.user_id, 'first_name', event.target.value)}
                        placeholder="Имя"
                        disabled={pendingUserId === user.user_id}
                      />
                      <input
                        className="field__control"
                        value={nameDrafts[user.user_id]?.last_name ?? ''}
                        onChange={(event) => updateDraft(user.user_id, 'last_name', event.target.value)}
                        placeholder="Фамилия"
                        disabled={pendingUserId === user.user_id}
                      />
                    </div>
                  ) : (
                    <div>
                      <strong>{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени'}</strong>
                      {getSelfLocked(user.user_id) ? <p className="muted">Ваш аккаунт недоступен для редактирования.</p> : null}
                    </div>
                  )}
                </td>
                <td>{user.email}</td>
                <td>
                  <StatusBadge
                    status={user.role}
                    label={formatRole(user.role)}
                    tone={getRoleTone(user.role)}
                  />
                </td>
                <td>
                  <StatusBadge
                    status={user.status}
                    label={formatStatus(user.status)}
                    tone={getStatusTone(user.status)}
                  />
                </td>
                <td>{formatDateTime(user.registered_at)}</td>
                <td>
                  <div className="users-actions">
                    <label className="users-actions__field">
                      <span>Роль</span>
                      <select
                        className="field__control"
                        value={user.role}
                        disabled={getSelfLocked(user.user_id) || pendingUserId === user.user_id}
                        onChange={(event) =>
                          updateUserMutation.mutate({
                            userId: user.user_id,
                            payload: { role: event.target.value as AdminUser['role'] },
                          })
                        }
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {formatRole(role)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="users-actions__field">
                      <span>Статус</span>
                      <select
                        className="field__control"
                        value={user.status}
                        disabled={getSelfLocked(user.user_id) || pendingUserId === user.user_id}
                        onChange={(event) =>
                          updateUserMutation.mutate({
                            userId: user.user_id,
                            payload: { status: event.target.value as AdminUser['status'] },
                          })
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="users-actions__buttons">
                      {editingUserId === user.user_id ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => handleNameSave(user)}
                            disabled={pendingUserId === user.user_id}
                          >
                            Сохранить имя
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => cancelEditing(user)}
                            disabled={pendingUserId === user.user_id}
                          >
                            Отмена
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => startEditing(user)}
                          disabled={getSelfLocked(user.user_id) || pendingUserId === user.user_id}
                        >
                          Редактировать имя
                        </Button>
                      )}
                      <Button
                        variant={selectedUserId === user.user_id ? 'secondary' : 'ghost'}
                        onClick={() => setSelectedUserId(user.user_id)}
                      >
                        Подробнее
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser ? (
        <div className="card">
          <div className="card__row">
            <div>
              <p className="eyebrow">Карточка пользователя</p>
              <h3>{[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || selectedUser.email}</h3>
            </div>
            <div className="user-badges">
              <StatusBadge status={selectedUser.role} label={formatRole(selectedUser.role)} tone={getRoleTone(selectedUser.role)} />
              <StatusBadge status={selectedUser.status} label={formatStatus(selectedUser.status)} tone={getStatusTone(selectedUser.status)} />
            </div>
          </div>

          {detailsQuery.isLoading ? <LoadingState message="Загружаем подробную информацию..." /> : null}
          {detailsQuery.isError ? <ErrorState message={extractApiError(detailsQuery.error)} /> : null}

          {detailsQuery.data ? (
            <dl className="description-list">
              <div>
                <dt>Email</dt>
                <dd>{detailsQuery.data.email}</dd>
              </div>
              <div>
                <dt>Дата регистрации</dt>
                <dd>{formatDateTime(detailsQuery.data.registered_at)}</dd>
              </div>
              <div>
                <dt>Последний вход</dt>
                <dd>{formatDateTime(detailsQuery.data.last_login_at)}</dd>
              </div>
              <div>
                <dt>Записан на курсы</dt>
                <dd>{detailsQuery.data.enrolled_courses_count}</dd>
              </div>
              <div>
                <dt>Отзывы</dt>
                <dd>{detailsQuery.data.reviews_count}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : null}
    </PageSection>
  );
};
