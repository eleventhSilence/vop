import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminTestUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

type TestFormValues = {
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
  const [formValues, setFormValues] = useState<TestFormValues>({
    title: '',
    description: '',
    passing_score: '',
    max_attempts: '',
    is_active: false,
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const testQuery = useQuery({
    queryKey: ['admin', 'test-detail', testId],
    queryFn: () => adminApi.testDetail(testId!),
    enabled: Boolean(testId),
  });

  useEffect(() => {
    if (!testQuery.data) {
      return;
    }

    setFormValues({
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

    if (!Number.isFinite(passingScore) || passingScore <= 0) {
      nextErrors.passing_score = 'Passing score должен быть числом больше 0.';
    }

    if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) {
      nextErrors.max_attempts = 'Max attempts должен быть числом больше 0.';
    }

    if (!formValues.title.trim()) {
      nextErrors.title = 'Введите название теста.';
    }

    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return null;
    }

    const payload: AdminTestUpdatePayload = {
      title: formValues.title.trim(),
      description: formValues.description.trim(),
      passing_score: passingScore,
      max_attempts: maxAttempts,
      is_active: formValues.is_active,
    };

    return payload;
  };

  const updateTestMutation = useMutation({
    mutationFn: (payload: AdminTestUpdatePayload) => adminApi.updateTest(testId!, payload),
    onSuccess: async () => {
      setSuccessMessage('Тест успешно сохранён.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'test-detail', testId], exact: true }),
      ]);
    },
  });

  const deleteTestMutation = useMutation({
    mutationFn: () => adminApi.deleteTest(testId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tests'] });
      navigate('/admin/tests');
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
    setSuccessMessage(null);
    const payload = validateForm();

    if (!payload) {
      return;
    }

    updateTestMutation.mutate(payload);
  };

  const handleDelete = () => {
    if (!testId) {
      return;
    }

    setSuccessMessage(null);

    if (!window.confirm('Удалить этот тест? Действие нельзя отменить.')) {
      return;
    }

    deleteTestMutation.mutate();
  };

  if (!testId) {
    return (
      <PageSection>
        <ErrorState message="Не удалось определить ID теста в маршруте." />
      </PageSection>
    );
  }

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Карточка теста</h2>
        <p className="muted">ID теста: {testId}</p>
      </div>
      {testQuery.isLoading ? <LoadingState /> : null}
      {testQuery.isError ? <ErrorState message={extractApiError(testQuery.error)} /> : null}
      {formErrorMessage ? <ErrorState message={formErrorMessage} /> : null}
      {updateTestMutation.isError ? <ErrorState message={extractApiError(updateTestMutation.error)} /> : null}
      {deleteTestMutation.isError ? <ErrorState message={extractApiError(deleteTestMutation.error)} /> : null}
      {successMessage ? <SuccessState message={successMessage} /> : null}
      {testQuery.isSuccess ? (
        <form className="card stack-list" onSubmit={handleSubmit}>
          <Input
            id="test-title"
            label="Название"
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
              rows={5}
            />
          </label>
          <Input
            id="test-passing-score"
            label="Passing score"
            type="number"
            min={1}
            step={1}
            value={formValues.passing_score}
            onChange={(event) => setFormValues((current) => ({ ...current, passing_score: event.target.value }))}
            error={validationErrors.passing_score}
          />
          <Input
            id="test-max-attempts"
            label="Max attempts"
            type="number"
            min={1}
            step={1}
            value={formValues.max_attempts}
            onChange={(event) => setFormValues((current) => ({ ...current, max_attempts: event.target.value }))}
            error={validationErrors.max_attempts}
          />
          <label className="field field--checkbox" htmlFor="test-is-active">
            <span className="field__label">Активен</span>
            <input
              id="test-is-active"
              type="checkbox"
              checked={formValues.is_active}
              onChange={(event) => setFormValues((current) => ({ ...current, is_active: event.target.checked }))}
            />
          </label>
          <div className="actions-row">
            <Button type="submit" disabled={updateTestMutation.isPending || deleteTestMutation.isPending}>
              {updateTestMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/tests')}
              disabled={updateTestMutation.isPending || deleteTestMutation.isPending}
            >
              К списку тестов
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={updateTestMutation.isPending || deleteTestMutation.isPending}
            >
              {deleteTestMutation.isPending ? 'Удаление...' : 'Удалить тест'}
            </Button>
          </div>
        </form>
      ) : null}
    </PageSection>
  );
};
