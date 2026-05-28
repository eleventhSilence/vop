import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import { coursesApi } from '@/entities/course/api';
import type { AdminTestCreatePayload, AdminTestUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { Toast } from '@/shared/ui/Toast';

type TestFormValues = {
  course_id: string;
  title: string;
  description: string;
  passing_score: string;
  max_attempts: string;
  is_active: boolean;
};

type ValidationErrors = Partial<Record<keyof TestFormValues, string>>;

export const AdminTestDetailPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { testId } = useParams();
  const isCreateMode = testId === 'new';

  const [formValues, setFormValues] = useState<TestFormValues>({
    course_id: '',
    title: '',
    description: '',
    passing_score: isCreateMode ? '5' : '',
    max_attempts: isCreateMode ? '3' : '',
    is_active: false,
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const testQuery = useQuery({
    queryKey: ['admin', 'test-detail', testId],
    queryFn: () => adminApi.testDetail(testId!),
    enabled: Boolean(testId) && !isCreateMode,
  });

  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'for-test-create'],
    queryFn: () => coursesApi.adminList({ page_size: 100 }),
    enabled: isCreateMode,
  });

  const createCourses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

  useEffect(() => {
    if (!testQuery.data) {
      return;
    }

    setFormValues({
      course_id: testQuery.data.course_id,
      title: testQuery.data.title,
      description: testQuery.data.description ?? '',
      passing_score: String(testQuery.data.passing_score),
      max_attempts: String(testQuery.data.max_attempts),
      is_active: testQuery.data.is_active,
    });
    setValidationErrors({});
  }, [testQuery.data]);

  const validateForm = () => {
    const nextErrors: ValidationErrors = {};
    const passingScore = Number(formValues.passing_score);
    const maxAttempts = Number(formValues.max_attempts);

    if (!formValues.title.trim()) {
      nextErrors.title = 'Введите название теста.';
    }

    if (!Number.isFinite(passingScore) || passingScore <= 0) {
      nextErrors.passing_score = 'Проходной балл должен быть числом больше 0.';
    }

    if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) {
      nextErrors.max_attempts = 'Количество попыток должно быть числом больше 0.';
    }

    if (isCreateMode && !formValues.course_id.trim()) {
      nextErrors.course_id = 'Выберите курс.';
    }

    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    return {
      ...(isCreateMode ? { course_id: formValues.course_id.trim() } : {}),
      title: formValues.title.trim(),
      description: formValues.description.trim(),
      passing_score: passingScore,
      max_attempts: maxAttempts,
      is_active: formValues.is_active,
    };
  };

  const createTestMutation = useMutation({
    mutationFn: (payload: AdminTestCreatePayload) => adminApi.createTest(payload),
    onSuccess: async (createdTest) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] });
      setToast({ type: 'success', message: 'Тест создан.' });
      navigate(`/admin/tests/${createdTest.test_id}`);
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const updateTestMutation = useMutation({
    mutationFn: (payload: AdminTestUpdatePayload) => adminApi.updateTest(testId!, payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Тест сохранён.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'test-detail', testId], exact: true }),
      ]);
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: () => adminApi.deleteTest(testId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] });
      setToast({ type: 'success', message: 'Тест удалён.' });
      navigate('/admin/tests');
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const formErrorMessage = useMemo(() => {
    if (Object.keys(validationErrors).length === 0) {
      return null;
    }

    return 'Проверьте корректность заполнения формы.';
  }, [validationErrors]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

    const payload = validateForm();
    if (!payload) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    if (isCreateMode) {
      createTestMutation.mutate(payload as AdminTestCreatePayload);
      return;
    }

    updateTestMutation.mutate(payload as AdminTestUpdatePayload);
  };

  const handleDelete = () => {
    if (!testId || isCreateMode) {
      return;
    }

    setToast(null);

    if (!window.confirm('Удалить этот тест? Действие нельзя отменить.')) {
      return;
    }

    deleteTestMutation.mutate();
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  if (!testId) {
    return (
      <PageSection>
        <ErrorState message="Не удалось определить ID теста в маршруте." />
      </PageSection>
    );
  }

  return (
    <PageSection>
      <div className="card admin-test-detail-header">
        <p className="eyebrow">Администрирование</p>
        <h2>{isCreateMode ? 'Создание теста' : 'Карточка теста'}</h2>
        <p className="muted">{isCreateMode ? 'Заполните обязательные поля для создания теста.' : `ID теста: ${testId}`}</p>
      </div>

      {!isCreateMode && testQuery.isLoading ? <LoadingState /> : null}
      {isCreateMode && coursesQuery.isLoading ? <LoadingState message="Загрузка курсов..." /> : null}
      {!isCreateMode && testQuery.isError ? <ErrorState message={extractApiError(testQuery.error)} /> : null}
      {isCreateMode && coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}

      {isCreateMode || testQuery.isSuccess ? (
        <form className="card stack-list admin-test-detail-form" onSubmit={handleSubmit}>
          {isCreateMode ? (
            <label className="field" htmlFor="test-course-id">
              <span className="field__label">Курс *</span>
              <select
                id="test-course-id"
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
          ) : null}

          <Input
            id="test-title"
            label="Название *"
            value={formValues.title}
            onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))}
            error={validationErrors.title}
            required
          />

          <label className="field" htmlFor="test-description">
            <span className="field__label">Описание</span>
            <textarea
              id="test-description"
              className="field__control"
              value={formValues.description}
              onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
              rows={6}
            />
          </label>

          <div className="admin-test-detail-metrics">
            <Input
              id="test-passing-score"
              label="Проходной балл *"
              type="number"
              min={1}
              step={1}
              value={formValues.passing_score}
              onChange={(event) => setFormValues((current) => ({ ...current, passing_score: event.target.value }))}
              error={validationErrors.passing_score}
              required
            />
            <Input
              id="test-max-attempts"
              label="Количество попыток *"
              type="number"
              min={1}
              step={1}
              value={formValues.max_attempts}
              onChange={(event) => setFormValues((current) => ({ ...current, max_attempts: event.target.value }))}
              error={validationErrors.max_attempts}
              required
            />
          </div>

          <label className="field field--checkbox" htmlFor="test-is-active">
            <span className="field__label">Активен</span>
            <input
              id="test-is-active"
              type="checkbox"
              checked={formValues.is_active}
              onChange={(event) => setFormValues((current) => ({ ...current, is_active: event.target.checked }))}
            />
          </label>

          {formErrorMessage ? <p className="field__error">{formErrorMessage}</p> : null}

          <div className="actions-row admin-action-bar">
            <Button type="submit" disabled={createTestMutation.isPending || updateTestMutation.isPending || deleteTestMutation.isPending}>
              {createTestMutation.isPending ? 'Создание...' : updateTestMutation.isPending ? 'Сохранение...' : isCreateMode ? 'Создать' : 'Сохранить'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/tests')}
              disabled={createTestMutation.isPending || updateTestMutation.isPending || deleteTestMutation.isPending}
            >
              К списку
            </Button>
            {!isCreateMode ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={createTestMutation.isPending || updateTestMutation.isPending || deleteTestMutation.isPending}
              >
                {deleteTestMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {toast ? <Toast message={toast.message} type={toast.type} /> : null}
    </PageSection>
  );
};
