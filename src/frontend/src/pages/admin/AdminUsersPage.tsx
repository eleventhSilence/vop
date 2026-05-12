import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/entities/admin/api';
import type { AdminUser, AdminUserUpdatePayload } from '@/entities/admin/types';
import { useAuth } from '@/features/auth/model/useAuth';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatRole, formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

type EditableName = {
  first_name: string;
  last_name: string;
};

const ROLE_OPTIONS: Array<AdminUser['role']> = ['USER', 'ADMIN'];
const STATUS_OPTIONS: Array<AdminUser['status']> = ['ACTIVE', 'BLOCKED'];
const getPageFromUrl = (url: string | null) => {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url, 'http://localhost');
    const page = parsedUrl.searchParams.get('page');

    return page ? Number(page) : null;
  } catch {
    return null;
  }
};

export const AdminUsersPage = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [knownPageSize, setKnownPageSize] = useState<number | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, EditableName>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page, search, roleFilter, statusFilter],
    queryFn: () =>
      adminApi.users({
        page,
        search: search || undefined,
        role: roleFilter,
        status: statusFilter,
      }),
  });
  const paginatedUsers = usersQuery.data
    ? ensurePaginated(usersQuery.data)
    : { count: 0, next: null, previous: null, results: [] };
  const users = paginatedUsers.results;
  const selectedUser = useMemo(
    () => users.find((user) => user.user_id === selectedUserId) ?? null,
    [selectedUserId, users],
  );
  const hasNextPage = Boolean(paginatedUsers.next);
  const hasPreviousPage = Boolean(paginatedUsers.previous);
  const nextPage = getPageFromUrl(paginatedUsers.next) ?? (hasNextPage ? page + 1 : null);
  const previousPage = getPageFromUrl(paginatedUsers.previous) ?? (hasPreviousPage ? Math.max(1, page - 1) : null);
  const pageSize = knownPageSize ?? (users.length || 1);
  const totalPages = Math.max(1, Math.ceil(paginatedUsers.count / pageSize));

  useEffect(() => {
    if (users.length && (!knownPageSize || users.length > knownPageSize)) {
      setKnownPageSize(users.length);
    }
  }, [knownPageSize, users.length]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      setEditingUserId(null);
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
    if (editingUserId && !users.some((user) => user.user_id === editingUserId)) {
      setEditingUserId(null);
    }
  }, [editingUserId, users]);

  useEffect(() => {
    if (editingUserId && selectedUserId && editingUserId !== selectedUserId) {
      setEditingUserId(null);
    }
  }, [editingUserId, selectedUserId]);

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
    queryKey: ['admin', 'user-detail', selectedUserId],
    queryFn: () => adminApi.userDetail(selectedUserId!),
    enabled: Boolean(selectedUserId),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminUserUpdatePayload }) => adminApi.updateUser(userId, payload),
    onMutate: ({ userId }) => {
      setPendingUserId(userId);
    },
    onSuccess: async (updatedUser, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', variables.userId], exact: true }),
      ]);
      setNameDrafts((current) => ({
        ...current,
        [variables.userId]: {
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
        },
      }));

      if ('first_name' in variables.payload || 'last_name' in variables.payload) {
        setEditingUserId((current) => (current === variables.userId ? null : current));
      }
    },
    onSettled: (_, __, variables) => {
      setPendingUserId((current) => (current === variables.userId ? null : current));
    },
  });

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
  const selectedUserDetails = detailsQuery.data ?? selectedUser;
  const isSelectedUserSelf = selectedUser ? getSelfLocked(selectedUser.user_id) : false;
  const isSelectedUserEditing = Boolean(selectedUserId && editingUserId === selectedUserId);
  const selectedUserDraft = selectedUserId ? nameDrafts[selectedUserId] : null;

  return (
    <PageSection className="page-section--wide">
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Администрирование пользователей</h2>
          <p className="muted">
            Управляйте ролями, статусами и именами через существующий admin API без перезагрузки страницы.
          </p>
        </div>
      </div>
      <div className="admin-users-toolbar">
        <div className="card admin-list-filters admin-list-filters--panel">
          <Input
            id="admin-users-search"
            label="Поиск"
            placeholder="Поиск по пользователям"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <label className="field" htmlFor="admin-users-role-filter">
            <span>Роль</span>
            <select
              id="admin-users-role-filter"
              className="field__control"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | 'user' | 'admin')}
            >
              <option value="all">Все роли</option>
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
          </label>
          <label className="field" htmlFor="admin-users-status-filter">
            <span>Статус</span>
            <select
              id="admin-users-status-filter"
              className="field__control"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активен</option>
              <option value="inactive">Неактивен</option>
            </select>
          </label>
        </div>
      </div>
      {usersQuery.isLoading ? <LoadingState /> : null}
      {usersQuery.isError ? <ErrorState message={extractApiError(usersQuery.error)} /> : null}
      {updateUserMutation.isError ? <ErrorState message={extractApiError(updateUserMutation.error)} /> : null}
      {!usersQuery.isLoading && !users.length ? <EmptyState message="Пользователи не найдены." /> : null}
      <div className="details-layout admin-users-layout">
        <div className="table-card admin-users-table-panel">
          <div className="table-card__header">
            <div>
              <strong>Всего пользователей: {paginatedUsers.count}</strong>
              <p className="muted">
                Страница {page} из {totalPages}. Сейчас показано {users.length} записей.
              </p>
              <p className="muted">Выберите строку в таблице, чтобы открыть данные пользователя справа.</p>
            </div>
            <div className="pagination-controls" aria-label="Пагинация пользователей">
              <Button
                variant="ghost"
                onClick={() => previousPage !== null && setPage(previousPage)}
                disabled={!hasPreviousPage || usersQuery.isLoading}
              >
                Назад
              </Button>
              <span className="pagination-controls__status">Страница {page}</span>
              <Button
                variant="ghost"
                onClick={() => nextPage !== null && setPage(nextPage)}
                disabled={!hasNextPage || usersQuery.isLoading}
              >
                Вперёд
              </Button>
            </div>
          </div>
          <div className="admin-users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Дата регистрации</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.user_id}
                    className={selectedUserId === user.user_id ? 'users-table__row users-table__row--selected' : 'users-table__row'}
                    onClick={() => setSelectedUserId(user.user_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedUserId(user.user_id);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={selectedUserId === user.user_id}
                  >
                    <td><strong>{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени'}</strong></td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="card admin-users-details" aria-label="Карточка выбранного пользователя">
          {selectedUser ? (
            <>
              <div className="card__row admin-users-details__header">
                <div>
                  <p className="eyebrow">Карточка пользователя</p>
                  <h3>{[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ') || selectedUser.email}</h3>
                  <p className="muted">Выберите пользователя слева, чтобы посмотреть и изменить его данные.</p>
                </div>
                <div className="user-badges">
                  <StatusBadge status={selectedUser.role} label={formatRole(selectedUser.role)} tone={getRoleTone(selectedUser.role)} />
                  <StatusBadge status={selectedUser.status} label={formatStatus(selectedUser.status)} tone={getStatusTone(selectedUser.status)} />
                </div>
              </div>

              {detailsQuery.isLoading ? <LoadingState message="Загружаем подробную информацию..." /> : null}
              {detailsQuery.isError ? <ErrorState message={extractApiError(detailsQuery.error)} /> : null}

              {selectedUserDetails ? (
                <div className="admin-user-panel">
                  <div className="admin-user-panel__section">
                    <div className="admin-user-panel__section-head">
                      <div>
                        <p className="eyebrow">Основные данные</p>
                        <h4>Имя пользователя</h4>
                      </div>
                      {!isSelectedUserEditing ? (
                        <Button
                          variant="ghost"
                          onClick={() => startEditing(selectedUser)}
                          disabled={isSelectedUserSelf || pendingUserId === selectedUser.user_id}
                        >
                          Редактировать
                        </Button>
                      ) : null}
                    </div>

                    {isSelectedUserEditing && selectedUserDraft ? (
                      <div className="inline-edit admin-user-panel__name-edit">
                        <input
                          className="field__control"
                          value={selectedUserDraft.first_name}
                          onChange={(event) => updateDraft(selectedUser.user_id, 'first_name', event.target.value)}
                          placeholder="Имя"
                          disabled={pendingUserId === selectedUser.user_id}
                        />
                        <input
                          className="field__control"
                          value={selectedUserDraft.last_name}
                          onChange={(event) => updateDraft(selectedUser.user_id, 'last_name', event.target.value)}
                          placeholder="Фамилия"
                          disabled={pendingUserId === selectedUser.user_id}
                        />
                        <div className="users-actions__buttons">
                          <Button
                            variant="secondary"
                            onClick={() => handleNameSave(selectedUser)}
                            disabled={pendingUserId === selectedUser.user_id}
                          >
                            Сохранить имя
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => cancelEditing(selectedUser)}
                            disabled={pendingUserId === selectedUser.user_id}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-user-panel__value-block">
                        <strong>{[selectedUserDetails.first_name, selectedUserDetails.last_name].filter(Boolean).join(' ') || 'Без имени'}</strong>
                      </div>
                    )}

                    {isSelectedUserSelf ? (
                      <p className="muted">Свой аккаунт можно просматривать, но нельзя менять роль, статус или имя.</p>
                    ) : null}
                  </div>

                  <div className="admin-user-panel__section">
                    <p className="eyebrow">Управление доступом</p>
                    <div className="admin-user-panel__form">
                      <label className="users-actions__field">
                        <span>Роль</span>
                        <select
                          className="field__control"
                          value={selectedUserDetails.role}
                          disabled={isSelectedUserSelf || pendingUserId === selectedUser.user_id}
                          onChange={(event) =>
                            updateUserMutation.mutate({
                              userId: selectedUser.user_id,
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
                          value={selectedUserDetails.status}
                          disabled={isSelectedUserSelf || pendingUserId === selectedUser.user_id}
                          onChange={(event) =>
                            updateUserMutation.mutate({
                              userId: selectedUser.user_id,
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
                    </div>
                  </div>

                  <dl className="description-list admin-user-panel__meta">
                    <div>
                      <dt>Email</dt>
                      <dd>{selectedUserDetails.email}</dd>
                    </div>
                    <div>
                      <dt>Дата регистрации</dt>
                      <dd>{formatDateTime(selectedUserDetails.registered_at)}</dd>
                    </div>
                    <div>
                      <dt>Последний вход</dt>
                      <dd>{formatDateTime(selectedUserDetails.last_login_at)}</dd>
                    </div>
                    <div>
                      <dt>Записан на курсы</dt>
                      <dd>{detailsQuery.data?.enrolled_courses_count ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Отзывы</dt>
                      <dd>{detailsQuery.data?.reviews_count ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState message="Выберите пользователя в таблице, чтобы посмотреть подробности." />
          )}
        </aside>
      </div>
    </PageSection>
  );
};
