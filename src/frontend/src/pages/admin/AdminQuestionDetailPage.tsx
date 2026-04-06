import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminQuestionType, AdminTestQuestionUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { Toast } from '@/shared/ui/Toast';

type QuestionFormValues = {
  text: string;
  question_type: AdminQuestionType;
  order: string;
};

type ValidationErrors = Partial<Record<keyof QuestionFormValues, string>>;

const defaultValues: QuestionFormValues = {
  text: '',
  question_type: 'single_choice',
  order: '1',
};

export const AdminQuestionDetailPage = () => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formValues, setFormValues] = useState<QuestionFormValues>(defaultValues);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const questionQuery = useQuery({
    queryKey: ['admin', 'question-detail', questionId],
    queryFn: () => adminApi.questionDetail(questionId!),
    enabled: Boolean(questionId),
  });

  useEffect(() => {
    if (!questionQuery.data) {
      return;
    }

    setFormValues({
      text: questionQuery.data.text,
      question_type: questionQuery.data.question_type,
      order: String(questionQuery.data.order),
    });
    setValidationErrors({});
  }, [questionQuery.data]);

  const validateValues = () => {
    const nextErrors: ValidationErrors = {};
    const order = Number(formValues.order);

    if (!formValues.text.trim()) {
      nextErrors.text = 'Введите текст вопроса.';
    }

    if (!Number.isInteger(order) || order <= 0) {
      nextErrors.order = 'Порядок должен быть целым числом больше 0.';
    }

    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return null;
    }

    return {
      text: formValues.text.trim(),
      question_type: formValues.question_type,
      order,
    };
  };

  const updateQuestionMutation = useMutation({
    mutationFn: (payload: AdminTestQuestionUpdatePayload) => adminApi.updateQuestion(questionId!, payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Вопрос обновлён.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'question-detail', questionId], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] }),
      ]);
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: () => adminApi.deleteQuestion(questionId!),
    onSuccess: async () => {
      if (questionQuery.data?.test_id) {
        await queryClient.invalidateQueries({ queryKey: ['admin', 'questions', questionQuery.data.test_id] });
      }
      setToast({ type: 'success', message: 'Вопрос удалён.' });
      navigate(questionQuery.data?.test_id ? `/admin/tests/${questionQuery.data.test_id}/questions` : '/admin/tests');
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

    const payload = validateValues();
    if (!payload) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    updateQuestionMutation.mutate(payload);
  };

  const handleDelete = () => {
    if (!questionId) {
      return;
    }

    setToast(null);

    if (!window.confirm('Удалить этот вопрос? Действие нельзя отменить.')) {
      return;
    }

    deleteQuestionMutation.mutate();
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  if (!questionId) {
    return (
      <PageSection>
        <ErrorState message="Не удалось определить ID вопроса в маршруте." />
      </PageSection>
    );
  }

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Карточка вопроса</h2>
        <p className="muted">ID вопроса: {questionId}</p>
        {questionQuery.data?.test_id ? (
          <p>
            <Link className="text-link" to={`/admin/tests/${questionQuery.data.test_id}/questions`}>
              ← Назад к вопросам теста
            </Link>
          </p>
        ) : null}
        <p>
          <Link className="text-link" to={`/admin/questions/${questionId}/options`}>
            Перейти к вариантам ответа →
          </Link>
        </p>
      </div>

      {questionQuery.isLoading ? <LoadingState message="Загрузка вопроса..." /> : null}
      {questionQuery.isError ? <ErrorState message={extractApiError(questionQuery.error)} /> : null}
      {!questionQuery.isLoading && !questionQuery.isError && !questionQuery.data ? <EmptyState message="Вопрос не найден." /> : null}

      {questionQuery.data ? (
        <form className="card stack-list" onSubmit={handleSubmit}>
          <Input
            id="question-detail-text"
            label="Текст вопроса *"
            value={formValues.text}
            onChange={(event) => setFormValues((current) => ({ ...current, text: event.target.value }))}
            error={validationErrors.text}
            required
          />

          <label className="field" htmlFor="question-detail-type">
            <span className="field__label">Тип вопроса *</span>
            <select
              id="question-detail-type"
              className="field__control"
              value={formValues.question_type}
              onChange={(event) => setFormValues((current) => ({ ...current, question_type: event.target.value as AdminQuestionType }))}
            >
              <option value="single_choice">single_choice</option>
              <option value="multiple_choice">multiple_choice</option>
            </select>
          </label>

          <Input
            id="question-detail-order"
            label="Порядок *"
            type="number"
            min={1}
            step={1}
            value={formValues.order}
            onChange={(event) => setFormValues((current) => ({ ...current, order: event.target.value }))}
            error={validationErrors.order}
            required
          />

          {formErrorMessage ? <p className="field__error">{formErrorMessage}</p> : null}

          <div className="actions-row admin-action-bar">
            <Button type="submit" disabled={updateQuestionMutation.isPending || deleteQuestionMutation.isPending}>
              {updateQuestionMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(questionQuery.data?.test_id ? `/admin/tests/${questionQuery.data.test_id}/questions` : '/admin/tests')}
              disabled={updateQuestionMutation.isPending || deleteQuestionMutation.isPending}
            >
              К списку вопросов
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={updateQuestionMutation.isPending || deleteQuestionMutation.isPending}
            >
              {deleteQuestionMutation.isPending ? 'Удаление...' : 'Удалить'}
            </Button>
          </div>
        </form>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
