import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminTestAttempt } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

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

const getUserName = (attempt: AdminTestAttempt) => {
  const fullName = `${attempt.first_name ?? ''} ${attempt.last_name ?? ''}`.trim();
  return fullName || 'Без имени';
};

const getAttemptResult = (attempt: AdminTestAttempt) => {
  if (attempt.status === 'in_progress') {
    return { label: 'В процессе', tone: 'info' as const };
  }

  if (attempt.is_passed) {
    return { label: 'Пройден', tone: 'success' as const };
  }

  return { label: 'Не пройден', tone: 'danger' as const };
};

export const AdminTestAttemptsPage = () => {
  const { testId } = useParams<{ testId: string }>();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [knownPageSize, setKnownPageSize] = useState<number | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const testQuery = useQuery({
    queryKey: ['admin', 'test', 'detail', testId],
    queryFn: () => adminApi.testDetail(testId as string),
    enabled: Boolean(testId),
  });

  const attemptsQuery = useQuery({
    queryKey: ['admin', 'test', 'attempts', testId, page, search],
    queryFn: () => adminApi.testAttempts(testId as string, { page, search: search || undefined }),
    enabled: Boolean(testId),
  });

  const paginatedAttempts = attemptsQuery.data
    ? ensurePaginated(attemptsQuery.data)
    : { count: 0, next: null, previous: null, results: [] };
  const attempts = paginatedAttempts.results;
  const hasNextPage = Boolean(paginatedAttempts.next);
  const hasPreviousPage = Boolean(paginatedAttempts.previous);
  const nextPage = getPageFromUrl(paginatedAttempts.next) ?? (hasNextPage ? page + 1 : null);
  const previousPage = getPageFromUrl(paginatedAttempts.previous) ?? (hasPreviousPage ? Math.max(1, page - 1) : null);
  const pageSize = knownPageSize ?? (attempts.length || 1);
  const totalPages = Math.max(1, Math.ceil(paginatedAttempts.count / pageSize));

  useEffect(() => {
    if (attempts.length && (!knownPageSize || attempts.length > knownPageSize)) {
      setKnownPageSize(attempts.length);
    }
  }, [attempts.length, knownPageSize]);

  return (
    <PageSection>
      <div className="card stack-list admin-question-context-card">
        <div className="admin-question-context-card__top">
          <div className="admin-question-context-card__content">
            <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
            <h2 className="admin-question-context-card__heading">Попытки прохождения теста · «{testQuery.data?.title ?? 'Тест'}»</h2>
            <span className="admin-question-page__test-chip">Курс: {testQuery.data?.course_title ?? '—'}</span>
          </div>
          <div className="admin-question-context-card__actions">
            <Link className="admin-question-page__back-chip" to="/admin/tests">← К списку тестов</Link>
          </div>
        </div>
      </div>

      <div className="stack-list">
        <div className="card admin-filters">
          <label className="field" htmlFor="admin-test-attempts-search">
            <span className="field__label">Поиск</span>
            <input
              id="admin-test-attempts-search"
              className="field__control"
              placeholder="Поиск по имени или фамилии пользователя"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
        </div>

        {(attemptsQuery.isLoading || testQuery.isLoading) ? <LoadingState /> : null}
        {attemptsQuery.isError ? <ErrorState message={extractApiError(attemptsQuery.error)} /> : null}

        {!attemptsQuery.isLoading && !attemptsQuery.isError ? (
          <div className="table-card admin-users-table-panel">
            <div className="table-card__header">
              <div>
                <strong>Всего попыток: {paginatedAttempts.count}</strong>
                <p className="muted">Страница {page} из {totalPages}. Сейчас показано {attempts.length} записей.</p>
              </div>
              <div className="pagination-controls" aria-label="Пагинация попыток прохождения теста">
                <Button variant="ghost" onClick={() => previousPage !== null && setPage(previousPage)} disabled={!hasPreviousPage || attemptsQuery.isLoading}>Назад</Button>
                <span className="pagination-controls__status">Страница {page}</span>
                <Button variant="ghost" onClick={() => nextPage !== null && setPage(nextPage)} disabled={!hasNextPage || attemptsQuery.isLoading}>Вперёд</Button>
              </div>
            </div>

            {attempts.length === 0 ? (
              <EmptyState message={search ? 'Попытки по заданному запросу не найдены.' : 'По этому тесту пока нет попыток прохождения.'} />
            ) : null}

            {attempts.length > 0 ? (
              <div className="admin-tests-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Email</th>
                      <th>Попытка</th>
                      <th>Результат</th>
                      <th>Баллы</th>
                      <th>Начата</th>
                      <th>Завершена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => {
                      const result = getAttemptResult(attempt);
                      return (
                        <tr key={attempt.attempt_id}>
                          <td><strong>{getUserName(attempt)}</strong></td>
                          <td>{attempt.email}</td>
                          <td>№ {attempt.attempt_number}</td>
                          <td><StatusBadge status={result.label} label={result.label} tone={result.tone} /></td>
                          <td>{attempt.status === 'in_progress' ? '—' : `${attempt.score} / ${attempt.max_score}`}</td>
                          <td>{attempt.started_at ? formatDateTime(attempt.started_at) : '—'}</td>
                          <td>{attempt.completed_at ? formatDateTime(attempt.completed_at) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </PageSection>
  );
};
