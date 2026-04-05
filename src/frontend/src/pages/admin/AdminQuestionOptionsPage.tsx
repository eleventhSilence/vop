import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminAnswerOptionCreatePayload, AdminAnswerOptionUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

type OptionFormValues = {
  text: string;
  is_correct: boolean;
  order: string;
};

type ValidationErrors = Partial<Record<keyof OptionFormValues, string>>;

const DEFAULT_VALUES: OptionFormValues = {
  text: '',
  is_correct: false,
  order: '1',
};

export const AdminQuestionOptionsPage = () => {
  const queryClient = useQueryClient();
  const { questionId } = useParams();
  const [createValues, setCreateValues] = useState<OptionFormValues>(DEFAULT_VALUES);
  const [createErrors, setCreateErrors] = useState<ValidationErrors>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<OptionFormValues>(DEFAULT_VALUES);
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const questionQuery = useQuery({
    queryKey: ['admin', 'question-detail', questionId],
    queryFn: () => adminApi.questionDetail(questionId!),
    enabled: Boolean(questionId),
  });

  const optionsQuery = useQuery({
    queryKey: ['admin', 'question-options', questionId],
    queryFn: () => adminApi.answerOptions({ question_id: questionId! }),
    enabled: Boolean(questionId),
  });

  const options = useMemo(() => {
    if (!questionId || !optionsQuery.data) {
      return [];
    }

    return ensurePaginated(optionsQuery.data).results
      .filter((option) => option.question_id === questionId)
      .sort((first, second) => first.order - second.order || first.created_at.localeCompare(second.created_at));
  }, [optionsQuery.data, questionId]);

  const validateValues = (values: OptionFormValues) => {
    const nextErrors: ValidationErrors = {};

    if (!values.text.trim()) {
      nextErrors.text = 'Введите текст варианта ответа.';
    }

    const order = Number(values.order);
    if (!Number.isInteger(order) || order <= 0) {
      nextErrors.order = 'Порядок должен быть целым числом больше 0.';
    }

    return {
      nextErrors,
      normalizedValues: { text: values.text.trim(), is_correct: values.is_correct, order },
    };
  };

  const unsetCorrectOptionsForSingleChoice = async (optionIdsToKeep: string[] = []) => {
    if (questionQuery.data?.question_type !== 'single_choice') {
      return;
    }

    const toUnset = options.filter((option) => option.is_correct && !optionIdsToKeep.includes(option.option_id));

    await Promise.all(toUnset.map((option) => adminApi.updateAnswerOption(option.option_id, { is_correct: false })));
  };

  const createOptionMutation = useMutation({
    mutationFn: async (payload: AdminAnswerOptionCreatePayload) => {
      if (questionQuery.data?.question_type === 'single_choice' && payload.is_correct) {
        await unsetCorrectOptionsForSingleChoice();
      }

      return adminApi.createAnswerOption(payload);
    },
    onSuccess: async () => {
      setSuccessMessage('Вариант ответа успешно создан.');
      setCreateValues(DEFAULT_VALUES);
      setCreateErrors({});
      await queryClient.invalidateQueries({ queryKey: ['admin', 'question-options', questionId], exact: true });
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: async ({ optionId, payload }: { optionId: string; payload: AdminAnswerOptionUpdatePayload }) => {
      if (questionQuery.data?.question_type === 'single_choice' && payload.is_correct) {
        await unsetCorrectOptionsForSingleChoice([optionId]);
      }

      return adminApi.updateAnswerOption(optionId, payload);
    },
    onSuccess: async () => {
      setSuccessMessage('Вариант ответа успешно обновлён.');
      setEditingOptionId(null);
      setEditErrors({});
      await queryClient.invalidateQueries({ queryKey: ['admin', 'question-options', questionId], exact: true });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId: string) => adminApi.deleteAnswerOption(optionId),
    onSuccess: async () => {
      setSuccessMessage('Вариант ответа успешно удалён.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'question-options', questionId], exact: true });
    },
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    if (!questionId) {
      return;
    }

    const { nextErrors, normalizedValues } = validateValues(createValues);
    setCreateErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    createOptionMutation.mutate({
      question_id: questionId,
      ...normalizedValues,
    });
  };

  const startEdit = (optionId: string, values: OptionFormValues) => {
    setSuccessMessage(null);
    setEditErrors({});
    setEditingOptionId(optionId);
    setEditValues(values);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>, optionId: string) => {
    event.preventDefault();
    setSuccessMessage(null);

    const { nextErrors, normalizedValues } = validateValues(editValues);
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    updateOptionMutation.mutate({ optionId, payload: normalizedValues });
  };

  const handleDelete = (optionId: string) => {
    setSuccessMessage(null);

    if (!window.confirm('Удалить этот вариант ответа? Действие нельзя отменить.')) {
      return;
    }

    deleteOptionMutation.mutate(optionId);
  };

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Варианты ответа</h2>
        <p className="muted">
          {questionQuery.data
            ? `Вопрос #${questionQuery.data.order}, тип: ${questionQuery.data.question_type}`
            : `ID вопроса: ${questionId ?? 'не определён'}`}
        </p>
        {questionQuery.data ? <p>{questionQuery.data.text}</p> : null}
        {questionQuery.data?.test_id ? (
          <p>
            <Link className="text-link" to={`/admin/tests/${questionQuery.data.test_id}/questions`}>
              ← Назад к списку вопросов теста
            </Link>
          </p>
        ) : null}
        {questionId ? (
          <p>
            <Link className="text-link" to={`/admin/questions/${questionId}`}>
              Открыть детали вопроса →
            </Link>
          </p>
        ) : null}
      </div>

      {!questionId ? <ErrorState message="Не удалось определить ID вопроса в маршруте." /> : null}
      {questionQuery.isLoading ? <LoadingState message="Загрузка вопроса..." /> : null}
      {optionsQuery.isLoading ? <LoadingState message="Загрузка вариантов ответа..." /> : null}
      {questionQuery.isError ? <ErrorState message={extractApiError(questionQuery.error)} /> : null}
      {optionsQuery.isError ? <ErrorState message={extractApiError(optionsQuery.error)} /> : null}
      {createOptionMutation.isError ? <ErrorState message={extractApiError(createOptionMutation.error)} /> : null}
      {updateOptionMutation.isError ? <ErrorState message={extractApiError(updateOptionMutation.error)} /> : null}
      {deleteOptionMutation.isError ? <ErrorState message={extractApiError(deleteOptionMutation.error)} /> : null}
      {successMessage ? <SuccessState message={successMessage} /> : null}

      {questionQuery.data?.question_type === 'single_choice' ? (
        <div className="state-box">
          Для single_choice только один вариант может быть правильным. При сохранении правильного варианта
          флаг is_correct у остальных будет автоматически снят.
        </div>
      ) : null}

      {questionId && !questionQuery.isLoading && !questionQuery.isError ? (
        <form className="card stack-list" onSubmit={handleCreate}>
          <h3>Создать вариант ответа</h3>
          <Input
            id="create-option-text"
            label="Текст варианта"
            value={createValues.text}
            onChange={(event) => setCreateValues((current) => ({ ...current, text: event.target.value }))}
            error={createErrors.text}
            required
          />
          <Input
            id="create-option-order"
            label="Порядок"
            type="number"
            min={1}
            step={1}
            value={createValues.order}
            onChange={(event) => setCreateValues((current) => ({ ...current, order: event.target.value }))}
            error={createErrors.order}
            required
          />
          <label className="field field--checkbox" htmlFor="create-option-correct">
            <span className="field__label">Правильный вариант</span>
            <input
              id="create-option-correct"
              type="checkbox"
              checked={createValues.is_correct}
              onChange={(event) => setCreateValues((current) => ({ ...current, is_correct: event.target.checked }))}
            />
          </label>
          <div className="actions-row">
            <Button type="submit" disabled={createOptionMutation.isPending}>
              {createOptionMutation.isPending ? 'Создание...' : 'Создать вариант'}
            </Button>
          </div>
        </form>
      ) : null}

      {!optionsQuery.isLoading && !optionsQuery.isError && questionId ? (
        <div className="stack-list">
          {options.length === 0 ? <EmptyState message="Для этого вопроса пока нет вариантов ответа." /> : null}
          {options.map((option, index) => {
            const isEditing = editingOptionId === option.option_id;
            const isSaving = updateOptionMutation.isPending && updateOptionMutation.variables?.optionId === option.option_id;
            const isDeleting = deleteOptionMutation.isPending && deleteOptionMutation.variables === option.option_id;

            return (
              <div className="card stack-list" key={option.option_id}>
                <p className="eyebrow">Вариант #{index + 1}</p>
                {isEditing ? (
                  <form className="stack-list" onSubmit={(event) => handleEditSubmit(event, option.option_id)}>
                    <Input
                      id={`option-order-${option.option_id}`}
                      label="Порядок"
                      type="number"
                      min={1}
                      step={1}
                      value={editValues.order}
                      onChange={(event) => setEditValues((current) => ({ ...current, order: event.target.value }))}
                      error={editErrors.order}
                      required
                    />
                    <Input
                      id={`option-text-${option.option_id}`}
                      label="Текст варианта"
                      value={editValues.text}
                      onChange={(event) => setEditValues((current) => ({ ...current, text: event.target.value }))}
                      error={editErrors.text}
                      required
                    />
                    <label className="field field--checkbox" htmlFor={`option-correct-${option.option_id}`}>
                      <span className="field__label">Правильный вариант</span>
                      <input
                        id={`option-correct-${option.option_id}`}
                        type="checkbox"
                        checked={editValues.is_correct}
                        onChange={(event) => setEditValues((current) => ({ ...current, is_correct: event.target.checked }))}
                      />
                    </label>
                    <div className="actions-row">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingOptionId(null)} disabled={isSaving}>
                        Отмена
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h3>{option.text}</h3>
                    <p className="muted">
                      is_correct: {option.is_correct ? 'true' : 'false'}, порядок: {option.order}
                    </p>
                    <div className="actions-row">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          startEdit(option.option_id, {
                            text: option.text,
                            is_correct: option.is_correct,
                            order: String(option.order),
                          })
                        }
                        disabled={deleteOptionMutation.isPending}
                      >
                        Редактировать
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => handleDelete(option.option_id)} disabled={isDeleting}>
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
