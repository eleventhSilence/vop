import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminCourseParticipant } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

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

const getProgressLabel = (participant: AdminCourseParticipant) => {
  if (participant.progress_status === 'completed' || participant.progress_percent >= 100) return 'Курс завершён';
  if (participant.progress_status === 'testing_in_progress' || participant.progress_percent >= 75) return 'На тестировании';
  if (participant.progress_status === 'theory_completed' || participant.progress_percent >= 50) return 'Теория завершена';
  return 'Теория не завершена';
};

const getParticipantName = (participant: AdminCourseParticipant) => {
  const fullName = `${participant.first_name ?? ''} ${participant.last_name ?? ''}`.trim();
  return fullName || 'Без имени';
};

export const AdminCourseParticipantsPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
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

  const courseQuery = useQuery({
    queryKey: ['admin', 'course', 'detail', courseId],
    queryFn: () => adminApi.courseDetail(courseId as string),
    enabled: Boolean(courseId),
  });

  const participantsQuery = useQuery({
    queryKey: ['admin', 'course', 'participants', courseId, page, search],
    queryFn: () => adminApi.courseParticipants(courseId as string, { page, search: search || undefined }),
    enabled: Boolean(courseId),
  });

  const paginatedParticipants = participantsQuery.data
    ? ensurePaginated(participantsQuery.data)
    : { count: 0, next: null, previous: null, results: [] };
  const participants = paginatedParticipants.results;
  const hasNextPage = Boolean(paginatedParticipants.next);
  const hasPreviousPage = Boolean(paginatedParticipants.previous);
  const nextPage = getPageFromUrl(paginatedParticipants.next) ?? (hasNextPage ? page + 1 : null);
  const previousPage = getPageFromUrl(paginatedParticipants.previous) ?? (hasPreviousPage ? Math.max(1, page - 1) : null);
  const pageSize = knownPageSize ?? (participants.length || 1);
  const totalPages = Math.max(1, Math.ceil(paginatedParticipants.count / pageSize));

  useEffect(() => {
    if (participants.length && (!knownPageSize || participants.length > knownPageSize)) {
      setKnownPageSize(participants.length);
    }
  }, [participants.length, knownPageSize]);

  const courseStatusLabel = courseQuery.data?.status === 'available' ? 'Курс доступен' : 'Курс недоступен';

  return (
    <PageSection>
      <div className="card stack-list admin-question-context-card">
        <div className="admin-question-context-card__top">
          <div className="admin-question-context-card__content">
            <p className="eyebrow">АДМИНИСТРИРОВАНИЕ</p>
            <h2 className="admin-question-context-card__heading">Участники курса · «{courseQuery.data?.title ?? 'Курс'}»</h2>
            {courseQuery.data ? (
              <div className="admin-question-context-card__meta">
                <div className="admin-test-card__meta">
                  <span className={`badge ${courseQuery.data.status === 'available' ? 'badge--success' : 'badge--warning'}`}>
                    {courseStatusLabel}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
          <div className="admin-question-context-card__actions">
            <Link className="admin-question-page__back-chip" to="/admin/courses">← К списку курсов</Link>
          </div>
        </div>
      </div>

      <div className="card admin-filters">
        <label className="field" htmlFor="admin-course-participants-search">
          <span className="field__label">Поиск</span>
          <input
            id="admin-course-participants-search"
            className="field__control"
            placeholder="Поиск по имени или фамилии"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
      </div>

      {participantsQuery.isLoading ? <LoadingState /> : null}
      {participantsQuery.isError ? <ErrorState message={extractApiError(participantsQuery.error)} /> : null}

      {!participantsQuery.isLoading && !participantsQuery.isError ? (
        <div className="table-card admin-users-table-panel">
          <div className="table-card__header">
            <div>
              <strong>Всего участников: {paginatedParticipants.count}</strong>
              <p className="muted">Страница {page} из {totalPages}. Сейчас показано {participants.length} записей.</p>
            </div>
            <div className="pagination-controls" aria-label="Пагинация участников курса">
              <Button variant="ghost" onClick={() => previousPage !== null && setPage(previousPage)} disabled={!hasPreviousPage || participantsQuery.isLoading}>Назад</Button>
              <span className="pagination-controls__status">Страница {page}</span>
              <Button variant="ghost" onClick={() => nextPage !== null && setPage(nextPage)} disabled={!hasNextPage || participantsQuery.isLoading}>Вперёд</Button>
            </div>
          </div>

          {participants.length === 0 ? (
            <EmptyState message={search ? 'Участники по заданному запросу не найдены.' : 'На этот курс пока никто не записался.'} />
          ) : null}

          {participants.length > 0 ? (
            <div className="admin-tests-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Email</th>
                    <th>Дата записи</th>
                    <th>Прогресс</th>
                    <th>Состояние</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((participant) => (
                    <tr key={participant.user_id}>
                      <td><strong>{getParticipantName(participant)}</strong></td>
                      <td>{participant.email}</td>
                      <td>{formatDateTime(participant.enrolled_at)}</td>
                      <td>{participant.progress_percent}%</td>
                      <td>{getProgressLabel(participant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </PageSection>
  );
};
