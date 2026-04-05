import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminQuestionType, AdminTestQuestionCreatePayload, AdminTestQuestionUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

type QuestionFormValues = {
  text: string;
  question_type: AdminQuestionType;
  order: string;
};

type ValidationErrors = Partial<Record<keyof QuestionFormValues, string>>;

export const AdminTestQuestionsPage = () => {
  const queryClient = useQueryClient();
  const { testId } = useParams();
  const [createValues, setCreateValues] = useState<QuestionFormValues>({ text: '', question_type: 'single_choice', order: '1' });
  const [createErrors, setCreateErrors] = useState<ValidationErrors>({});
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<QuestionFormValues>({ text: '', question_type: 'single_choice', order: '1' });
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const testQuery = useQuery({
    queryKey: ['admin', 'test-detail', testId],
    queryFn: () => adminApi.testDetail(testId!),
    enabled: Boolean(testId),
  });
  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions', testId],
    queryFn: () => adminApi.questions(),
    enabled: Boolean(testId),
  });

  const questions = useMemo(() => {
    if (!questionsQuery.data || !testId) {
      return [];
    }

    return ensurePaginated(questionsQuery.data).results
      .filter((question) => question.test_id === testId)
      .sort((first, second) => first.order - second.order);
  }, [questionsQuery.data, testId]);

  const createQuestionMutation = useMutation({
    mutationFn: (payload: AdminTestQuestionCreatePayload) => adminApi.createQuestion(payload),
    onSuccess: async () => {
      setSuccessMessage('Вопрос успешно создан.');
      setCreateValues({ text: '', question_type: 'single_choice', order: '1' });
      setCreateErrors({});
      await queryClient.invalidateQueries({ queryKey: ['admin', 'questions', testId], exact: true });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, payload }: { questionId: string; payload: AdminTestQuestionUpdatePayload }) =>
      adminApi.updateQuestion(questionId, payload),
    onSuccess: async () => {
      setSuccessMessage('Вопрос успешно обновлён.');
      setEditingQuestionId(null);
      setEditErrors({});
      await queryClient.invalidateQueries({ queryKey: ['admin', 'questions', testId], exact: true });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => adminApi.deleteQuestion(questionId),
    onSuccess: async () => {
      setSuccessMessage('Вопрос успешно удалён.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'questions', testId], exact: true });
    },
  });

  const validateValues = (values: QuestionFormValues) => {
    const nextErrors: ValidationErrors = {};
    const order = Number(values.order);

    if (!values.text.trim()) {
      nextErrors.text = 'Введите текст вопроса.';
    }

    if (!Number.isInteger(order) || order <= 0) {
      nextErrors.order = 'Порядок должен быть целым числом больше 0.';
    }

    return { nextErrors, normalizedOrder: order };
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    if (!testId) {
      return;
    }

    const { nextErrors, normalizedOrder } = validateValues(createValues);
    setCreateErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    createQuestionMutation.mutate({
      test_id: testId,
      text: createValues.text.trim(),
      question_type: createValues.question_type,
      order: normalizedOrder,
    });
  };

  const startEdit = (questionId: string, values: QuestionFormValues) => {
    setSuccessMessage(null);
    setEditErrors({});
    setEditingQuestionId(questionId);
    setEditValues(values);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>, questionId: string) => {
    event.preventDefault();
    setSuccessMessage(null);
    const { nextErrors, normalizedOrder } = validateValues(editValues);
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    updateQuestionMutation.mutate({
      questionId,
      payload: {
        text: editValues.text.trim(),
        question_type: editValues.question_type,
        order: normalizedOrder,
      },
    });
  };

  const handleDelete = (questionId: string) => {
    setSuccessMessage(null);
    if (!window.confirm('Удалить этот вопрос? Действие нельзя отменить.')) {
      return;
    }
    deleteQuestionMutation.mutate(questionId);
  };

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Управление вопросами теста</h2>
        <p className="muted">
          {testQuery.data ? `Тест: ${testQuery.data.title}` : `ID теста: ${testId ?? 'не определён'}`}
        </p>
        {testId ? (
          <p>
            <Link className="text-link" to={`/admin/tests/${testId}`}>
              ← Назад к тесту
            </Link>
          </p>
        ) : null}
      </div>
      {!testId ? <ErrorState message="Не удалось определить ID теста в маршруте." /> : null}
      {testQuery.isLoading ? <LoadingState message="Загрузка теста..." /> : null}
      {questionsQuery.isLoading ? <LoadingState message="Загрузка вопросов..." /> : null}
      {testQuery.isError ? <ErrorState message={extractApiError(testQuery.error)} /> : null}
      {questionsQuery.isError ? <ErrorState message={extractApiError(questionsQuery.error)} /> : null}
      {createQuestionMutation.isError ? <ErrorState message={extractApiError(createQuestionMutation.error)} /> : null}
      {updateQuestionMutation.isError ? <ErrorState message={extractApiError(updateQuestionMutation.error)} /> : null}
      {deleteQuestionMutation.isError ? <ErrorState message={extractApiError(deleteQuestionMutation.error)} /> : null}
      {successMessage ? <SuccessState message={successMessage} /> : null}
      {testId && !testQuery.isLoading && !testQuery.isError ? (
        <form className="card stack-list" onSubmit={handleCreate}>
          <h3>Создать вопрос</h3>
          <Input
            id="create-question-text"
            label="Текст вопроса"
            value={createValues.text}
            onChange={(event) => setCreateValues((current) => ({ ...current, text: event.target.value }))}
            error={createErrors.text}
            required
          />
          <label className="field" htmlFor="create-question-type">
            <span className="field__label">Тип вопроса</span>
            <select
              id="create-question-type"
              className="field__control"
              value={createValues.question_type}
              onChange={(event) =>
                setCreateValues((current) => ({ ...current, question_type: event.target.value as AdminQuestionType }))
              }
            >
              <option value="single_choice">single_choice</option>
              <option value="multiple_choice">multiple_choice</option>
            </select>
          </label>
          <Input
            id="create-question-order"
            label="Порядок"
            type="number"
            min={1}
            step={1}
            value={createValues.order}
            onChange={(event) => setCreateValues((current) => ({ ...current, order: event.target.value }))}
            error={createErrors.order}
            required
          />
          <div className="actions-row">
            <Button type="submit" disabled={createQuestionMutation.isPending}>
              {createQuestionMutation.isPending ? 'Создание...' : 'Создать вопрос'}
            </Button>
          </div>
        </form>
      ) : null}
      {!questionsQuery.isLoading && !questionsQuery.isError && testId ? (
        <div className="stack-list">
          {questions.length === 0 ? <EmptyState message="У этого теста пока нет вопросов." /> : null}
          {questions.map((question) => {
            const isEditing = editingQuestionId === question.question_id;
            const isSaving = updateQuestionMutation.isPending && isEditing;
            const isDeleting = deleteQuestionMutation.isPending && deleteQuestionMutation.variables === question.question_id;

            return (
              <div className="card stack-list" key={question.question_id}>
                {isEditing ? (
                  <form className="stack-list" onSubmit={(event) => handleEditSubmit(event, question.question_id)}>
                    <Input
                      id={`question-text-${question.question_id}`}
                      label="Текст вопроса"
                      value={editValues.text}
                      onChange={(event) => setEditValues((current) => ({ ...current, text: event.target.value }))}
                      error={editErrors.text}
                      required
                    />
                    <label className="field" htmlFor={`question-type-${question.question_id}`}>
                      <span className="field__label">Тип вопроса</span>
                      <select
                        id={`question-type-${question.question_id}`}
                        className="field__control"
                        value={editValues.question_type}
                        onChange={(event) =>
                          setEditValues((current) => ({ ...current, question_type: event.target.value as AdminQuestionType }))
                        }
                      >
                        <option value="single_choice">single_choice</option>
                        <option value="multiple_choice">multiple_choice</option>
                      </select>
                    </label>
                    <Input
                      id={`question-order-${question.question_id}`}
                      label="Порядок"
                      type="number"
                      min={1}
                      step={1}
                      value={editValues.order}
                      onChange={(event) => setEditValues((current) => ({ ...current, order: event.target.value }))}
                      error={editErrors.order}
                      required
                    />
                    <div className="actions-row">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingQuestionId(null)} disabled={isSaving}>
                        Отмена
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h3>{question.text}</h3>
                    <p className="muted">
                      Тип: {question.question_type}, порядок: {question.order}
                    </p>
                    <div className="stack-list">
                      <Link className="text-link" to={`/admin/questions/${question.question_id}`}>
                        Открыть карточку вопроса →
                      </Link>
                      <Link className="text-link" to={`/admin/questions/${question.question_id}/options`}>
                        Управлять вариантами ответа →
                      </Link>
                    </div>
                    <div className="actions-row">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          startEdit(question.question_id, {
                            text: question.text,
                            question_type: question.question_type,
                            order: String(question.order),
                          })
                        }
                      >
                        Редактировать
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => handleDelete(question.question_id)} disabled={isDeleting}>
                        {isDeleting ? 'Удаление...' : 'Удалить'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </PageSection>
  );
};
