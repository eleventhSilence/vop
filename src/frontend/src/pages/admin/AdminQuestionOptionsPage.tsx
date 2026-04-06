import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminAnswerOptionCreatePayload, AdminAnswerOptionUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { Toast } from '@/shared/ui/Toast';

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
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<OptionFormValues>(DEFAULT_VALUES);
  const [createErrors, setCreateErrors] = useState<ValidationErrors>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<OptionFormValues>(DEFAULT_VALUES);
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateErrors({});
    setCreateValues(DEFAULT_VALUES);
  };

  const closeEdit = () => {
    setEditingOptionId(null);
    setEditErrors({});
    setEditValues(DEFAULT_VALUES);
  };

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
      setToast({ type: 'success', message: 'Вариант ответа создан.' });
      closeCreate();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'question-options', questionId], exact: true });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
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
      setToast({ type: 'success', message: 'Вариант ответа обновлён.' });
      closeEdit();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'question-options', questionId], exact: true });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId: string) => adminApi.deleteAnswerOption(optionId),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Вариант ответа удалён.' });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'question-options', questionId], exact: true });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

    if (!questionId) {
      return;
    }

    const { nextErrors, normalizedValues } = validateValues(createValues);
    setCreateErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    createOptionMutation.mutate({
      question_id: questionId,
      ...normalizedValues,
    });
  };

  const startEdit = (optionId: string, values: OptionFormValues) => {
    setToast(null);
    setEditErrors({});
    setEditingOptionId(optionId);
    setEditValues(values);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>, optionId: string) => {
    event.preventDefault();
    setToast(null);

    const { nextErrors, normalizedValues } = validateValues(editValues);
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    updateOptionMutation.mutate({ optionId, payload: normalizedValues });
  };

  const handleDelete = (optionId: string) => {
    setToast(null);

    if (!window.confirm('Удалить этот вариант ответа? Действие нельзя отменить.')) {
      return;
    }

    deleteOptionMutation.mutate(optionId);
  };

  const handleOptionCardKeyDown = (event: KeyboardEvent<HTMLElement>, optionId: string, values: OptionFormValues) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    startEdit(optionId, values);
  };

  const stopActionPropagation = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const handleDeleteAction = (event: MouseEvent<HTMLButtonElement>, optionId: string) => {
    event.stopPropagation();
    handleDelete(optionId);
  };

  const editingOption = options.find((option) => option.option_id === editingOptionId) ?? null;

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  return (
    <PageSection>
      <div className="card stack-list admin-question-context-card">
        <div className="admin-question-context-card__top">
          <div className="admin-question-context-card__content">
            <p className="eyebrow">Администрирование</p>
            <h2 className="admin-question-context-card__heading">Варианты ответа</h2>
            <p className="muted">ID вопроса: {questionId ?? 'не определён'}</p>
            {questionQuery.data ? (
              <>
                <div className="admin-question-context__meta">
                  <StatusBadge status={questionQuery.data.question_type} label={`Тип: ${questionQuery.data.question_type}`} tone="accent" />
                  <StatusBadge status="order" label={`Порядок вопроса: ${questionQuery.data.order}`} tone="neutral" />
                </div>
                <p className="admin-question-context__text">{questionQuery.data.text}</p>
              </>
            ) : null}
          </div>
          <div className="admin-question-context-card__actions">
            {questionId && !questionQuery.isLoading && !questionQuery.isError ? (
              <Button className="admin-tests-create-trigger" onClick={() => setCreateOpen(true)}>
                Добавить вариант
              </Button>
            ) : null}
            {questionQuery.data?.test_id ? (
              <>
                <Link className="admin-question-page__back-chip" to={`/admin/tests/${questionQuery.data.test_id}`}>
                  ← Назад к тесту
                </Link>
                <Link className="admin-question-page__back-chip" to={`/admin/tests/${questionQuery.data.test_id}/questions`}>
                  К вопросам теста
                </Link>
              </>
            ) : null}
            {questionId ? (
              <Link className="admin-question-page__back-chip" to={`/admin/questions/${questionId}`}>
                Открыть детали вопроса
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {!questionId ? <ErrorState message="Не удалось определить ID вопроса в маршруте." /> : null}
      {questionQuery.isLoading ? <LoadingState message="Загрузка вопроса..." /> : null}
      {optionsQuery.isLoading ? <LoadingState message="Загрузка вариантов ответа..." /> : null}
      {questionQuery.isError ? <ErrorState message={extractApiError(questionQuery.error)} /> : null}
      {optionsQuery.isError ? <ErrorState message={extractApiError(optionsQuery.error)} /> : null}

      {questionQuery.data?.question_type === 'single_choice' ? (
        <div className="admin-options-hint">
          <span className="badge badge--neutral">single_choice</span>
          <span>Только один вариант может быть правильным — остальные флаги снимаются автоматически.</span>
        </div>
      ) : null}

      {isCreateOpen ? (
        <div className="overlay" role="presentation" onClick={closeCreate}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Создание варианта ответа</h3>
              <Button variant="ghost" type="button" onClick={closeCreate}>
                Закрыть
              </Button>
            </div>
            <form className="stack-list" onSubmit={handleCreate}>
              <Input
                id="create-option-text"
                label="Текст варианта *"
                value={createValues.text}
                onChange={(event) => setCreateValues((current) => ({ ...current, text: event.target.value }))}
                error={createErrors.text}
                required
              />
              <Input
                id="create-option-order"
                label="Порядок *"
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
                <Button variant="ghost" type="button" onClick={closeCreate}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createOptionMutation.isPending}>
                  {createOptionMutation.isPending ? 'Создание...' : 'Создать'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {!optionsQuery.isLoading && !optionsQuery.isError && questionId ? (
        <div className="stack-list admin-questions-list">
          {options.length === 0 ? <EmptyState message="Для этого вопроса пока нет вариантов ответа." /> : null}
          {options.map((option) => {
            const isDeleting = deleteOptionMutation.isPending && deleteOptionMutation.variables === option.option_id;

            return (
              <article
                className={`card admin-test-card admin-interactive-card admin-option-card ${option.is_correct ? 'admin-option-card--correct' : ''}`}
                key={option.option_id}
                role="button"
                tabIndex={0}
                aria-label={`Открыть редактирование варианта «${option.text}»`}
                onClick={() =>
                  startEdit(option.option_id, {
                    text: option.text,
                    is_correct: option.is_correct,
                    order: String(option.order),
                  })
                }
                onKeyDown={(event) =>
                  handleOptionCardKeyDown(event, option.option_id, {
                    text: option.text,
                    is_correct: option.is_correct,
                    order: String(option.order),
                  })
                }
              >
                <div className="card__row admin-option-card__header">
                  <h3 className="admin-test-card__title">{option.text}</h3>
                  <StatusBadge
                    status={option.is_correct ? 'correct' : 'incorrect'}
                    label={option.is_correct ? 'Правильный' : 'Неправильный'}
                    tone={option.is_correct ? 'success' : 'neutral'}
                  />
                </div>
                <div className="admin-test-card__meta">
                  <span className="badge badge--neutral">Порядок: {option.order}</span>
                  <span className="badge badge--default">
                    {questionQuery.data?.question_type === 'multiple_choice' ? 'Множественный выбор' : 'Один выбор'}
                  </span>
                </div>
                <div className="admin-test-card__footer admin-question-card__footer">
                  <Link className="admin-test-card__questions-chip" to={`/admin/questions/${questionId}`} onClick={stopActionPropagation}>
                    Открыть детали вопроса
                  </Link>
                  <Button type="button" variant="ghost" onClick={(event) => handleDeleteAction(event, option.option_id)} disabled={isDeleting}>
                    {isDeleting ? 'Удаление...' : 'Удалить'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {editingOptionId && editingOption ? (
        <div className="overlay" role="presentation" onClick={closeEdit}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Редактирование варианта ответа</h3>
              <Button variant="ghost" type="button" onClick={closeEdit}>
                Закрыть
              </Button>
            </div>
            <form className="stack-list" onSubmit={(event) => handleEditSubmit(event, editingOption.option_id)}>
              <Input
                id={`option-text-${editingOption.option_id}`}
                label="Текст варианта *"
                value={editValues.text}
                onChange={(event) => setEditValues((current) => ({ ...current, text: event.target.value }))}
                error={editErrors.text}
                required
              />
              <Input
                id={`option-order-${editingOption.option_id}`}
                label="Порядок *"
                type="number"
                min={1}
                step={1}
                value={editValues.order}
                onChange={(event) => setEditValues((current) => ({ ...current, order: event.target.value }))}
                error={editErrors.order}
                required
              />
              <label className="field field--checkbox" htmlFor={`option-correct-${editingOption.option_id}`}>
                <span className="field__label">Правильный вариант</span>
                <input
                  id={`option-correct-${editingOption.option_id}`}
                  type="checkbox"
                  checked={editValues.is_correct}
                  onChange={(event) => setEditValues((current) => ({ ...current, is_correct: event.target.checked }))}
                />
              </label>
              <div className="actions-row admin-action-bar">
                <Button variant="ghost" type="button" onClick={closeEdit}>
                  Отмена
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => handleDelete(editingOption.option_id)}
                  disabled={updateOptionMutation.isPending || deleteOptionMutation.isPending}
                >
                  {deleteOptionMutation.isPending ? 'Удаление...' : 'Удалить'}
                </Button>
                <Button type="submit" disabled={updateOptionMutation.isPending || deleteOptionMutation.isPending}>
                  {updateOptionMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
