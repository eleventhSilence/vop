import { useEffect, useState } from 'react';
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

type EditableUser = {
  first_name: string;
  last_name: string;
  role: AdminUser['role'];
  status: AdminUser['status'];
};

const ROLE_OPTIONS: Array<AdminUser['role']> = ['USER', 'ADMIN'];
const STATUS_OPTIONS: Array<AdminUser['status']> = ['ACTIVE', 'BLOCKED'];
const getPageFromUrl = (url: string | null) => {
  if (!url) return null;
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
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editDraft, setEditDraft] = useState<EditableUser | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [knownPageSize, setKnownPageSize] = useState<number | null>(null);

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

  const paginatedUsers = usersQuery.data ? ensurePaginated(usersQuery.data) : { count: 0, next: null, previous: null, results: [] };
  const users = paginatedUsers.results;
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

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: AdminUserUpdatePayload }) => adminApi.updateUser(userId, payload),
    onMutate: ({ userId }) => setPendingUserId(userId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', variables.userId], exact: true }),
      ]);
      setEditingUser(null);
      setEditDraft(null);
    },
    onSettled: (_, __, variables) => setPendingUserId((current) => (current === variables.userId ? null : current)),
  });

  const getSelfLocked = (userId: string) => currentUser?.user_id === userId;
  const getRoleTone = (role: string) => (role === 'ADMIN' ? 'accent' : 'neutral');
  const getStatusTone = (status: string) => (status === 'ACTIVE' ? 'success' : 'danger');

  const startEditing = (user: AdminUser) => {
    setEditingUser(user);
    setEditDraft({ first_name: user.first_name, last_name: user.last_name, role: user.role, status: user.status });
  };
  const closeEditOverlay = () => {
    setEditingUser(null);
    setEditDraft(null);
  };
  const handleSaveUser = () => {
    if (!editingUser || !editDraft) return;
    updateUserMutation.mutate({
      userId: editingUser.user_id,
      payload: {
        first_name: editDraft.first_name.trim(),
        last_name: editDraft.last_name.trim(),
        role: editDraft.role,
        status: editDraft.status,
      },
    });
  };

  return (
    <PageSection className="page-section--wide">
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Администрирование пользователей</h2>
          <p className="muted">Управляйте ролями, статусами и именами через существующий admin API без перезагрузки страницы.</p>
        </div>
      </div>
      <div className="admin-page-controls admin-users-toolbar">
        <div className="card admin-list-filters admin-list-filters--panel">
          <Input id="admin-users-search" label="Поиск" placeholder="Поиск по пользователям" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <label className="field" htmlFor="admin-users-role-filter">
            <span>Роль</span>
            <select id="admin-users-role-filter" className="field__control" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | 'user' | 'admin')}>
              <option value="all">Все роли</option><option value="user">Пользователь</option><option value="admin">Администратор</option>
            </select>
          </label>
          <label className="field" htmlFor="admin-users-status-filter">
            <span>Статус</span>
            <select id="admin-users-status-filter" className="field__control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">Все статусы</option><option value="active">Активен</option><option value="inactive">Неактивен</option>
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
              <p className="muted">Страница {page} из {totalPages}. Сейчас показано {users.length} записей.</p>
            </div>
            <div className="pagination-controls" aria-label="Пагинация пользователей">
              <Button variant="ghost" onClick={() => previousPage !== null && setPage(previousPage)} disabled={!hasPreviousPage || usersQuery.isLoading}>Назад</Button>
              <span className="pagination-controls__status">Страница {page}</span>
              <Button variant="ghost" onClick={() => nextPage !== null && setPage(nextPage)} disabled={!hasNextPage || usersQuery.isLoading}>Вперёд</Button>
            </div>
          </div>
          <div className="admin-users-table-wrap">
            <table className="users-table">
              <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Статус</th><th>Дата регистрации</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="users-table__row"
                    onClick={() => startEditing(user)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        startEditing(user);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    title="Открыть карточку пользователя"
                  >
                    <td><strong>{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Без имени'}</strong></td>
                    <td>{user.email}</td>
                    <td><StatusBadge status={user.role} label={formatRole(user.role)} tone={getRoleTone(user.role)} /></td>
                    <td><StatusBadge status={user.status} label={formatStatus(user.status)} tone={getStatusTone(user.status)} /></td>
                    <td>{formatDateTime(user.registered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingUser && editDraft ? (
        <div className="overlay" role="presentation" onClick={closeEditOverlay}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <div>
                <h3>Редактирование пользователя</h3>
                <p className="muted">{[editingUser.first_name, editingUser.last_name].filter(Boolean).join(' ') || 'Без имени'}</p>
              </div>
            </div>
            <section className="admin-user-panel__section">
              <div className="admin-user-panel__section-head">
                <div>
                  <p className="eyebrow">Редактируемые данные</p>
                </div>
              </div>
            <div className="grid-2">
              <label className="field"><span>Имя</span><input className="field__control" value={editDraft.first_name} onChange={(e) => setEditDraft((c) => (c ? { ...c, first_name: e.target.value } : c))} /></label>
              <label className="field"><span>Фамилия</span><input className="field__control" value={editDraft.last_name} onChange={(e) => setEditDraft((c) => (c ? { ...c, last_name: e.target.value } : c))} /></label>
              <label className="field"><span>Роль</span><select className="field__control" value={editDraft.role} onChange={(e) => setEditDraft((c) => (c ? { ...c, role: e.target.value as AdminUser['role'] } : c))} disabled={getSelfLocked(editingUser.user_id)}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></label>
              <label className="field"><span>Статус</span><select className="field__control" value={editDraft.status} onChange={(e) => setEditDraft((c) => (c ? { ...c, status: e.target.value as AdminUser['status'] } : c))} disabled={getSelfLocked(editingUser.user_id)}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
            </div>
            </section>
            <section className="admin-user-panel__section">
              <div className="admin-user-panel__section-head">
                <div>
                  <p className="eyebrow">Служебная информация</p>
                </div>
              </div>
              <div className="admin-user-panel__meta grid-2">
                <div className="admin-user-panel__value-block">
                  <p className="muted">Email</p>
                  <strong>{editingUser.email}</strong>
                </div>
                <div className="admin-user-panel__value-block">
                  <p className="muted">Дата регистрации</p>
                  <strong>{formatDateTime(editingUser.registered_at)}</strong>
                </div>
                <div className="admin-user-panel__value-block">
                  <p className="muted">Последний вход</p>
                  <strong>{editingUser.last_login_at ? formatDateTime(editingUser.last_login_at) : 'Нет данных'}</strong>
                </div>
              </div>
            </section>
            <div className="users-actions__buttons">
              <Button variant="secondary" onClick={handleSaveUser} disabled={pendingUserId === editingUser.user_id}>Сохранить</Button>
              <Button variant="ghost" onClick={closeEditOverlay} disabled={pendingUserId === editingUser.user_id}>Отмена</Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageSection>
  );
};
