import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminCourseStatus, AdminTestCreatePayload, AdminTestUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Toast } from '@/shared/ui/Toast';

type CreateTestFormValues = {
  course_id: string;
  title: string;
  description: string;
  passing_score: string;
  max_attempts: string;
  is_active: boolean;
};

type ValidationErrors = Partial<Record<keyof CreateTestFormValues, string>>;

const defaultFormValues: CreateTestFormValues = {
  course_id: '',
  title: '',
  description: '',
  passing_score: '70',
  max_attempts: '1',
  is_active: true,
};

export const AdminTestsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const hasFocusedFromQueryRef = useRef(false);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editTestId, setEditTestId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CreateTestFormValues>(defaultFormValues);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [editFormValues, setEditFormValues] = useState<CreateTestFormValues>(defaultFormValues);
  const [editValidationErrors, setEditValidationErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | AdminCourseStatus>('all');
  const [knownPageSize, setKnownPageSize] = useState<number | null>(null);

  const getPageFromUrl = (url: string | null) => {
    if (!url) return null;
    try {
      const parsedUrl = new URL(url, 'http://localhost');
      const nextPage = parsedUrl.searchParams.get('page');
      return nextPage ? Number(nextPage) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const testsQuery = useQuery({
    queryKey: ['admin', 'tests', page, search, statusFilter],
    queryFn: () => adminApi.tests({ page, search, status: statusFilter }),
  });
  const coursesQuery = useQuery({ queryKey: ['admin', 'courses', 'for-test-create'], queryFn: () => adminApi.courses({ page_size: 100 }) });

  const paginatedTests = testsQuery.data ? ensurePaginated(testsQuery.data) : { count: 0, next: null, previous: null, results: [] };
  const tests = paginatedTests.results;
  const hasNextPage = Boolean(paginatedTests.next);
  const hasPreviousPage = Boolean(paginatedTests.previous);
  const nextPage = getPageFromUrl(paginatedTests.next) ?? (hasNextPage ? page + 1 : null);
  const previousPage = getPageFromUrl(paginatedTests.previous) ?? (hasPreviousPage ? Math.max(1, page - 1) : null);
  const pageSize = knownPageSize ?? (tests.length || 1);
  const totalPages = Math.max(1, Math.ceil(paginatedTests.count / pageSize));
  const createCourses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];
  useEffect(() => {
    if (tests.length && (!knownPageSize || tests.length > knownPageSize)) {
      setKnownPageSize(tests.length);
    }
  }, [knownPageSize, tests.length]);

  const createTestMutation = useMutation({
    mutationFn: (payload: AdminTestCreatePayload) => adminApi.createTest(payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Тест успешно создан.' });
      setFormValues(defaultFormValues);
      setValidationErrors({});
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const updateTestMutation = useMutation({
    mutationFn: ({ testId, payload }: { testId: string; payload: AdminTestUpdatePayload }) => adminApi.updateTest(testId, payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Тест сохранён.' });
      closeEdit();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: (testId: string) => adminApi.deleteTest(testId),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Тест удалён.' });
      closeEdit();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const formErrorMessage = useMemo(() => {
    if (!Object.keys(validationErrors).length) {
      return null;
    }

    return 'Проверьте корректность заполнения формы.';
  }, [validationErrors]);

  const closeCreate = () => {
    setCreateOpen(false);
    setValidationErrors({});
    setFormValues(defaultFormValues);
  };

  const closeEdit = () => {
    setEditTestId(null);
    setEditValidationErrors({});
    setEditFormValues(defaultFormValues);
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

    const nextErrors: ValidationErrors = {};
    const passingScore = Number(formValues.passing_score);
    const maxAttempts = Number(formValues.max_attempts);

    if (!formValues.course_id.trim()) {
      nextErrors.course_id = 'Выберите курс.';
    }

    if (!formValues.title.trim()) {
      nextErrors.title = 'Введите название теста.';
    }

    if (!Number.isFinite(passingScore) || passingScore <= 0) {
      nextErrors.passing_score = 'Passing score должен быть числом больше 0.';
    }

    if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) {
      nextErrors.max_attempts = 'Max attempts должен быть числом больше 0.';
    }

    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    createTestMutation.mutate({
      course_id: formValues.course_id.trim(),
      title: formValues.title.trim(),
      description: formValues.description.trim(),
      passing_score: passingScore,
      max_attempts: maxAttempts,
      is_active: formValues.is_active,
    });
  };

  const openEdit = (testId: string) => {
    const currentTest = tests.find((test) => test.test_id === testId);

    if (!currentTest) {
      return;
    }

    setEditTestId(currentTest.test_id);
    setEditValidationErrors({});
    setEditFormValues({
      course_id: currentTest.course_id,
      title: currentTest.title,
      description: currentTest.description,
      passing_score: String(currentTest.passing_score),
      max_attempts: String(currentTest.max_attempts),
      is_active: currentTest.is_active,
    });
  };

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

    if (!editTestId) {
      return;
    }

    const nextErrors: ValidationErrors = {};
    const passingScore = Number(editFormValues.passing_score);
    const maxAttempts = Number(editFormValues.max_attempts);

    if (!editFormValues.title.trim()) {
      nextErrors.title = 'Введите название теста.';
    }

    if (!Number.isFinite(passingScore) || passingScore <= 0) {
      nextErrors.passing_score = 'Passing score должен быть числом больше 0.';
    }

    if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) {
      nextErrors.max_attempts = 'Max attempts должен быть числом больше 0.';
    }

    setEditValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    updateTestMutation.mutate({
      testId: editTestId,
      payload: {
        title: editFormValues.title.trim(),
        description: editFormValues.description.trim(),
        passing_score: passingScore,
        max_attempts: maxAttempts,
        is_active: editFormValues.is_active,
      },
    });
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (testsQuery.isError) {
      setToast({ type: 'error', message: extractApiError(testsQuery.error) });
    }
  }, [testsQuery.error, testsQuery.isError]);

  useEffect(() => {
    if (testsQuery.isLoading || hasFocusedFromQueryRef.current) {
      return;
    }

    const focusTestId = searchParams.get('focusTestId');
    if (!focusTestId) {
      return;
    }

    const focusNode = document.getElementById(`admin-test-${focusTestId}`);
    if (!focusNode) {
      return;
    }

    focusNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    focusNode.focus({ preventScroll: true });
    hasFocusedFromQueryRef.current = true;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('focusTestId');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, testsQuery.isLoading]);

  const openTestCard = (testId: string) => {
    openEdit(testId);
  };

  const openTestQuestions = (event: MouseEvent<HTMLElement>, testId: string) => {
    event.stopPropagation();
    navigate(`/admin/tests/${testId}/questions`);
  };

  const handleTestCardKeyDown = (event: KeyboardEvent<HTMLElement>, testId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openTestCard(testId);
  };

  const editTest = tests.find((test) => test.test_id === editTestId) ?? null;

  const editFormErrorMessage = useMemo(() => {
    if (!Object.keys(editValidationErrors).length) {
      return null;
    }

    return 'Проверьте корректность заполнения формы.';
  }, [editValidationErrors]);

  const handleDelete = () => {
    if (!editTestId) {
      return;
    }

    if (!window.confirm('Удалить этот тест? Действие нельзя отменить.')) {
      return;
    }

    setToast(null);
    deleteTestMutation.mutate(editTestId);
  };

  return (
    <PageSection>
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Администрирование тестов</h2>
          <p className="muted">Контролируйте тесты и их доступность, сохраняя текущее поведение поиска и фильтрации.</p>
        </div>
      </div>
      <div className="admin-page-controls admin-tests-toolbar">
        <div className="card admin-list-filters admin-list-filters--panel">
          <Input id="admin-tests-search" label="Поиск" placeholder="Поиск по тестам" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <label className="field" htmlFor="admin-tests-status-filter">
            <span className="field__label">Статус</span>
            <select id="admin-tests-status-filter" className="field__control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | AdminCourseStatus)}>
              <option value="all">Все статусы</option>
              <option value="available">Доступен</option>
              <option value="unavailable">Недоступен</option>
            </select>
          </label>
        </div>
        <Button className="admin-tests-create-trigger" onClick={() => setCreateOpen(true)}>
          Создать тест
        </Button>
      </div>

      {isCreateOpen ? (
        <div className="overlay" role="presentation" onClick={closeCreate}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Создание теста</h3>
              <Button variant="ghost" type="button" onClick={closeCreate}>
                Закрыть
              </Button>
            </div>
            {formErrorMessage ? <p className="field__error">{formErrorMessage}</p> : null}
            <form className="stack-list" onSubmit={handleCreate}>
              <label className="field" htmlFor="admin-test-create-course-id">
                <span className="field__label">Курс *</span>
                <select
                  id="admin-test-create-course-id"
                  className="field__control"
                  value={formValues.course_id}
                  onChange={(event) => setFormValues((current) => ({ ...current, course_id: event.target.value }))}
                  required
                >
                  <option value="">Выберите курс</option>
                  {createCourses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                {validationErrors.course_id ? <span className="field__error">{validationErrors.course_id}</span> : null}
              </label>
              <Input
                id="admin-test-create-title"
                label="Название *"
                value={formValues.title}
                onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))}
                error={validationErrors.title}
                required
              />
              <label className="field" htmlFor="admin-test-create-description">
                <span className="field__label">Описание</span>
                <textarea
                  id="admin-test-create-description"
                  className="field__control"
                  value={formValues.description}
                  onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
                  rows={5}
                />
              </label>
              <Input
                id="admin-test-create-passing-score"
                label="Passing score *"
                type="number"
                min={1}
                step={1}
                value={formValues.passing_score}
                onChange={(event) => setFormValues((current) => ({ ...current, passing_score: event.target.value }))}
                error={validationErrors.passing_score}
                required
              />
              <Input
                id="admin-test-create-max-attempts"
                label="Max attempts *"
                type="number"
                min={1}
                step={1}
                value={formValues.max_attempts}
                onChange={(event) => setFormValues((current) => ({ ...current, max_attempts: event.target.value }))}
                error={validationErrors.max_attempts}
                required
              />
              <label className="field field--checkbox" htmlFor="admin-test-create-is-active">
                <span className="field__label">Активен</span>
                <input
                  id="admin-test-create-is-active"
                  type="checkbox"
                  checked={formValues.is_active}
                  onChange={(event) => setFormValues((current) => ({ ...current, is_active: event.target.checked }))}
                />
              </label>
              <div className="actions-row">
                <Button variant="ghost" type="button" onClick={closeCreate}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createTestMutation.isPending || coursesQuery.isLoading}>
                  {createTestMutation.isPending ? 'Создание...' : 'Создать'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editTestId && editTest ? (
        <div className="overlay" role="presentation" onClick={closeEdit}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Редактирование теста</h3>
              <Button variant="ghost" type="button" onClick={closeEdit}>
                Закрыть
              </Button>
            </div>
            {editFormErrorMessage ? <p className="field__error">{editFormErrorMessage}</p> : null}
            <form className="stack-list" onSubmit={handleEdit}>
              <section className="admin-user-panel__section">
                <div className="admin-user-panel__section-head">
                  <div>
                    <p className="eyebrow">Редактируемые данные</p>
                  </div>
                </div>
              <label className="field" htmlFor="admin-test-edit-course-id">
                <span className="field__label">Курс</span>
                <input id="admin-test-edit-course-id" className="field__control" value={editTest.course_title} readOnly />
              </label>
              <Input
                id="admin-test-edit-title"
                label="Название *"
                value={editFormValues.title}
                onChange={(event) => setEditFormValues((current) => ({ ...current, title: event.target.value }))}
                error={editValidationErrors.title}
                required
              />
              <label className="field" htmlFor="admin-test-edit-description">
                <span className="field__label">Описание</span>
                <textarea
                  id="admin-test-edit-description"
                  className="field__control"
                  value={editFormValues.description}
                  onChange={(event) => setEditFormValues((current) => ({ ...current, description: event.target.value }))}
                  rows={5}
                />
              </label>
              <Input
                id="admin-test-edit-passing-score"
                label="Passing score *"
                type="number"
                min={1}
                step={1}
                value={editFormValues.passing_score}
                onChange={(event) => setEditFormValues((current) => ({ ...current, passing_score: event.target.value }))}
                error={editValidationErrors.passing_score}
                required
              />
              <Input
                id="admin-test-edit-max-attempts"
                label="Max attempts *"
                type="number"
                min={1}
                step={1}
                value={editFormValues.max_attempts}
                onChange={(event) => setEditFormValues((current) => ({ ...current, max_attempts: event.target.value }))}
                error={editValidationErrors.max_attempts}
                required
              />
              <label className="field field--checkbox" htmlFor="admin-test-edit-is-active">
                <span className="field__label">Активен</span>
                <input
                  id="admin-test-edit-is-active"
                  type="checkbox"
                  checked={editFormValues.is_active}
                  onChange={(event) => setEditFormValues((current) => ({ ...current, is_active: event.target.checked }))}
                />
              </label>
              </section>
              <section className="admin-user-panel__section">
                <div className="admin-user-panel__section-head">
                  <div>
                    <p className="eyebrow">Служебная информация</p>
                  </div>
                </div>
                <div className="admin-user-panel__meta grid-2">
                  <div className="admin-user-panel__value-block">
                    <p className="muted">Дата создания</p>
                    <strong>{editTest.created_at ? formatDateTime(editTest.created_at) : '—'}</strong>
                  </div>
                  <div className="admin-user-panel__value-block">
                    <p className="muted">Дата обновления</p>
                    <strong>{editTest.updated_at ? formatDateTime(editTest.updated_at) : '—'}</strong>
                  </div>
                </div>
              </section>
              <div className="actions-row admin-action-bar">
                <Button variant="ghost" type="button" onClick={closeEdit}>
                  Отмена
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={handleDelete}
                  disabled={updateTestMutation.isPending || deleteTestMutation.isPending}
                >
                  {deleteTestMutation.isPending ? 'Удаление...' : 'Удалить'}
                </Button>
                <Button type="submit" disabled={updateTestMutation.isPending || deleteTestMutation.isPending}>
                  {updateTestMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {testsQuery.isLoading ? <LoadingState /> : null}
      {coursesQuery.isLoading && isCreateOpen ? <LoadingState message="Загрузка курсов..." /> : null}

      {!testsQuery.isLoading && !testsQuery.isError ? (
        <div className="table-card admin-tests-table-panel">
          <div className="table-card__header">
            <div>
              <strong>Всего тестов: {paginatedTests.count}</strong>
              <p className="muted">Страница {page} из {totalPages}. Сейчас показано {tests.length} записей.</p>
            </div>
            <div className="pagination-controls" aria-label="Пагинация тестов">
              <Button variant="ghost" onClick={() => previousPage !== null && setPage(previousPage)} disabled={!hasPreviousPage || testsQuery.isLoading}>Назад</Button>
              <span className="pagination-controls__status">Страница {page}</span>
              <Button variant="ghost" onClick={() => nextPage !== null && setPage(nextPage)} disabled={!hasNextPage || testsQuery.isLoading}>Вперёд</Button>
            </div>
          </div>
          {tests.length === 0 ? <EmptyState message={search || statusFilter !== 'all' ? 'Тесты не найдены.' : 'Тесты пока не созданы.'} /> : null}
          {tests.length ? (
            <div className="admin-tests-table-wrap">
              <table className="users-table">
                <thead><tr><th>Название теста</th><th>Название курса</th><th>Статус</th><th>Дата обновления</th><th>Вопросы</th></tr></thead>
                <tbody>
                  {tests.map((test) => (
                    <tr
                      id={`admin-test-${test.test_id}`}
                      key={test.test_id}
                      className="users-table__row"
                      onClick={() => openTestCard(test.test_id)}
                      onKeyDown={(event) => handleTestCardKeyDown(event, test.test_id)}
                      tabIndex={0}
                      role="button"
                      title={`Открыть карточку теста «${test.title}»`}
                    >
                      <td className="admin-tests-table__title"><strong>{test.title}</strong></td>
                      <td>{test.course_title}</td>
                      <td><StatusBadge status={test.is_active ? 'active' : 'inactive'} label={test.is_active ? 'Активен' : 'Неактивен'} tone={test.is_active ? 'success' : 'danger'} /></td>
                      <td>{test.updated_at ? formatDateTime(test.updated_at) : '—'}</td>
                      <td>
                        <Link
                          className="admin-test-card__questions-chip"
                          to={`/admin/tests/${test.test_id}/questions`}
                          onClick={(event) => openTestQuestions(event, test.test_id)}
                        >
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
