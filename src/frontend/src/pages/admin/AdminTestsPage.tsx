import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminTestCreatePayload, AdminTestUpdatePayload } from '@/entities/admin/types';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
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
  const queryClient = useQueryClient();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editTestId, setEditTestId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CreateTestFormValues>(defaultFormValues);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [editFormValues, setEditFormValues] = useState<CreateTestFormValues>(defaultFormValues);
  const [editValidationErrors, setEditValidationErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const testsQuery = useQuery({ queryKey: ['admin', 'tests'], queryFn: () => testingApi.adminTests() });
  const coursesQuery = useQuery({ queryKey: ['admin', 'courses', 'for-test-create'], queryFn: () => adminApi.courses({ page_size: 100 }) });

  const tests = testsQuery.data ? ensurePaginated(testsQuery.data).results : [];
  const createCourses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

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

  const openTestCard = (testId: string) => {
    openEdit(testId);
  };

  const openTestQuestions = (event: MouseEvent<HTMLButtonElement>, testId: string) => {
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
      <h2>Администратор: тесты</h2>
      <div className="admin-tests-toolbar">
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
        <div className="stack-list admin-tests-list">
          {tests.length === 0 ? <EmptyState message="Тесты пока не созданы." /> : null}
          {tests.map((test) => (
            <article
              className={`card admin-test-card admin-interactive-card ${test.is_active ? 'admin-test-card--active' : 'admin-test-card--inactive'}`}
              key={test.test_id}
              role="button"
              tabIndex={0}
              aria-label={`Открыть карточку теста «${test.title}»`}
              onClick={() => openTestCard(test.test_id)}
              onKeyDown={(event) => handleTestCardKeyDown(event, test.test_id)}
            >
              <div className="card__row admin-test-card__header">
                <h3 className="admin-test-card__title">{test.title}</h3>
                <StatusBadge status={test.is_active ? 'active' : 'inactive'} label={test.is_active ? 'Активен' : 'Неактивен'} tone={test.is_active ? 'success' : 'danger'} />
              </div>
              <p className="muted">Курс: {test.course_title}</p>
              <div className="admin-test-card__meta">
                <span className="badge badge--default">Passing score: {test.passing_score}</span>
                <span className="badge badge--neutral">Max attempts: {test.max_attempts}</span>
              </div>
              <div className="admin-test-card__footer">
                <button
                  type="button"
                  className="admin-test-card__questions-chip"
                  aria-label={`Перейти к вопросам теста «${test.title}»`}
                  onClick={(event) => openTestQuestions(event, test.test_id)}
                >
                  Вопросы →
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
