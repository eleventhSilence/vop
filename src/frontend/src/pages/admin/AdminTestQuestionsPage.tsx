import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminQuestionType, AdminTestQuestionCreatePayload, AdminTestQuestionUpdatePayload } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
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

const defaultQuestionFormValues: QuestionFormValues = { text: '', question_type: 'single_choice', order: '1' };

export const AdminTestQuestionsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { testId } = useParams();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<QuestionFormValues>(defaultQuestionFormValues);
  const [createErrors, setCreateErrors] = useState<ValidationErrors>({});
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<QuestionFormValues>(defaultQuestionFormValues);
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [page, setPage] = useState(1);
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

  const testQuery = useQuery({
    queryKey: ['admin', 'test-detail', testId],
    queryFn: () => adminApi.testDetail(testId!),
    enabled: Boolean(testId),
  });
  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions', testId, page],
    queryFn: () => adminApi.questions({ test_id: testId!, page }),
    enabled: Boolean(testId),
  });

  const paginatedQuestions = questionsQuery.data ? ensurePaginated(questionsQuery.data) : { count: 0, next: null, previous: null, results: [] };
  const questions = useMemo(
    () => [...paginatedQuestions.results].sort((first, second) => first.order - second.order),
    [paginatedQuestions.results],
  );
  const hasNextPage = Boolean(paginatedQuestions.next);
  const hasPreviousPage = Boolean(paginatedQuestions.previous);
  const nextPage = getPageFromUrl(paginatedQuestions.next) ?? (hasNextPage ? page + 1 : null);
  const previousPage = getPageFromUrl(paginatedQuestions.previous) ?? (hasPreviousPage ? Math.max(1, page - 1) : null);
  const pageSize = knownPageSize ?? (questions.length || 1);
  const totalPages = Math.max(1, Math.ceil(paginatedQuestions.count / pageSize));

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateErrors({});
    setCreateValues(defaultQuestionFormValues);
  };

  const closeEdit = () => {
    setEditingQuestionId(null);
    setEditErrors({});
    setEditValues(defaultQuestionFormValues);
  };

  const createQuestionMutation = useMutation({
    mutationFn: (payload: AdminTestQuestionCreatePayload) => adminApi.createQuestion(payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Вопрос успешно создан.' });
      closeCreate();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'questions', testId] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, payload }: { questionId: string; payload: AdminTestQuestionUpdatePayload }) =>
      adminApi.updateQuestion(questionId, payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Вопрос успешно обновлён.' });
      closeEdit();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'questions', testId] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => adminApi.deleteQuestion(questionId),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Вопрос успешно удалён.' });
      closeEdit();
      await queryClient.invalidateQueries({ queryKey: ['admin', 'questions', testId] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
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
    setToast(null);

    if (!testId) {
      return;
    }

    const { nextErrors, normalizedOrder } = validateValues(createValues);
    setCreateErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
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
    setToast(null);
    setEditErrors({});
    setEditingQuestionId(questionId);
    setEditValues(values);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>, questionId: string) => {
    event.preventDefault();
    setToast(null);
    const { nextErrors, normalizedOrder } = validateValues(editValues);
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
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
    setToast(null);
    if (!window.confirm('Удалить этот вопрос? Действие нельзя отменить.')) {
      return;
    }
    deleteQuestionMutation.mutate(questionId);
  };

  const openQuestionOptions = (event: MouseEvent<HTMLButtonElement>, questionId: string) => {
    event.stopPropagation();
    navigate(`/admin/questions/${questionId}/options`);
  };

  useEffect(() => {
    setPage(1);
  }, [testId]);

  useEffect(() => {
    if (questions.length && (!knownPageSize || questions.length > knownPageSize)) {
      setKnownPageSize(questions.length);
    }
  }, [knownPageSize, questions.length]);

  const handleQuestionCardKeyDown = (event: KeyboardEvent<HTMLElement>, questionId: string, values: QuestionFormValues) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    startEdit(questionId, values);
  };

  const editingQuestion = questions.find((question) => question.question_id === editingQuestionId) ?? null;

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (testQuery.isError) {
      setToast({ type: 'error', message: extractApiError(testQuery.error) });
    }
  }, [testQuery.error, testQuery.isError]);

  useEffect(() => {
    if (questionsQuery.isError) {
      setToast({ type: 'error', message: extractApiError(questionsQuery.error) });
    }
  }, [questionsQuery.error, questionsQuery.isError]);

  return (
    <PageSection>
      <div className="card stack-list admin-question-context-card">
        <div className="admin-question-context-card__top">
          <div className="admin-question-context-card__content">
            <p className="eyebrow">Администрирование</p>
            <h2 className="admin-question-context-card__heading">
              {testQuery.data ? `Администрирование вопросов теста · «${testQuery.data.title}»` : 'Администрирование вопросов теста'}
            </h2>
            {testQuery.data ? (
              <div className="admin-question-context-card__meta">
                <div className="admin-test-card__meta">
                  <span className="badge badge--default">Курс: {testQuery.data.course_title}</span>
                </div>
              </div>
            ) : (
              <p className="muted">ID теста: {testId ?? 'не определён'}</p>
            )}
          </div>
          <div className="admin-question-context-card__actions">
            {testId && !testQuery.isLoading && !testQuery.isError ? (
              <Button className="admin-tests-create-trigger" onClick={() => setCreateOpen(true)}>
                Создать вопрос
              </Button>
            ) : null}
            <Link className="admin-question-page__back-chip" to={testId ? `/admin/tests?focusTestId=${testId}` : '/admin/tests'}>
              ← К списку тестов
            </Link>
          </div>
        </div>
      </div>

      {!testId ? <ErrorState message="Не удалось определить ID теста в маршруте." /> : null}
      {testQuery.isLoading ? <LoadingState message="Загрузка теста..." /> : null}
      {questionsQuery.isLoading ? <LoadingState message="Загрузка вопросов..." /> : null}

      {isCreateOpen ? (
        <div className="overlay" role="presentation" onClick={closeCreate}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Создание вопроса</h3>
              <Button variant="ghost" type="button" onClick={closeCreate}>
                Закрыть
              </Button>
            </div>
            <form className="stack-list" onSubmit={handleCreate}>
              <Input
                id="create-question-text"
                label="Текст вопроса *"
                value={createValues.text}
                onChange={(event) => setCreateValues((current) => ({ ...current, text: event.target.value }))}
                error={createErrors.text}
                required
              />
              <label className="field" htmlFor="create-question-type">
                <span className="field__label">Тип вопроса *</span>
                <select
                  id="create-question-type"
                  className="field__control"
                  value={createValues.question_type}
                  onChange={(event) =>
                    setCreateValues((current) => ({ ...current, question_type: event.target.value as AdminQuestionType }))
                  }
                  required
                >
                  <option value="single_choice">single_choice</option>
                  <option value="multiple_choice">multiple_choice</option>
                </select>
              </label>
              <Input
                id="create-question-order"
                label="Порядок *"
                type="number"
                min={1}
                step={1}
                value={createValues.order}
                onChange={(event) => setCreateValues((current) => ({ ...current, order: event.target.value }))}
                error={createErrors.order}
                required
              />
              <div className="actions-row">
                <Button variant="ghost" type="button" onClick={closeCreate}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createQuestionMutation.isPending}>
                  {createQuestionMutation.isPending ? 'Создание...' : 'Создать'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {!questionsQuery.isLoading && !questionsQuery.isError && testId ? (
        <div className="details-layout admin-users-layout">
          <div className="table-card admin-users-table-panel">
            <div className="table-card__header">
              <div>
                <strong>Всего вопросов: {paginatedQuestions.count}</strong>
                <p className="muted">Страница {page} из {totalPages}. Сейчас показано {questions.length} записей.</p>
              </div>
              <div className="pagination-controls" aria-label="Пагинация вопросов">
                <Button variant="ghost" onClick={() => previousPage !== null && setPage(previousPage)} disabled={!hasPreviousPage || questionsQuery.isLoading}>Назад</Button>
                <span className="pagination-controls__status">Страница {page}</span>
                <Button variant="ghost" onClick={() => nextPage !== null && setPage(nextPage)} disabled={!hasNextPage || questionsQuery.isLoading}>Вперёд</Button>
              </div>
            </div>
            {questions.length === 0 ? <EmptyState message="У этого теста пока нет вопросов." /> : null}
            {questions.length > 0 ? (
              <div className="admin-tests-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Порядок</th>
                      <th>Текст вопроса</th>
                      <th>Тип ответа</th>
                      <th>Варианты ответов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((question) => (
                      <tr
                        key={question.question_id}
                        className="users-table__row"
                        onClick={() => startEdit(question.question_id, { text: question.text, question_type: question.question_type, order: String(question.order) })}
                        onKeyDown={(event) =>
                          handleQuestionCardKeyDown(event, question.question_id, {
                            text: question.text,
                            question_type: question.question_type,
                            order: String(question.order),
                          })
                        }
                        tabIndex={0}
                        role="button"
                        title="Открыть редактирование вопроса"
                      >
                        <td><strong>{question.order}</strong></td>
                        <td className="admin-questions-table__text">{question.text}</td>
                        <td>
                          <span className="badge badge--default">
                            {question.question_type === 'single_choice' ? 'Один вариант' : 'Несколько вариантов'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-test-card__questions-chip"
                            onClick={(event) => openQuestionOptions(event, question.question_id)}
                          >
                            Открыть →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {editingQuestionId && editingQuestion ? (
        <div className="overlay" role="presentation" onClick={closeEdit}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Редактирование вопроса</h3>
              <Button variant="ghost" type="button" onClick={closeEdit}>
                Закрыть
              </Button>
            </div>
            <form className="stack-list" onSubmit={(event) => handleEditSubmit(event, editingQuestion.question_id)}>
              <Input
                id={`question-text-${editingQuestion.question_id}`}
                label="Текст вопроса *"
                value={editValues.text}
                onChange={(event) => setEditValues((current) => ({ ...current, text: event.target.value }))}
                error={editErrors.text}
                required
              />
              <label className="field" htmlFor={`question-type-${editingQuestion.question_id}`}>
                <span className="field__label">Тип вопроса *</span>
                <select
                  id={`question-type-${editingQuestion.question_id}`}
                  className="field__control"
                  value={editValues.question_type}
                  onChange={(event) =>
                    setEditValues((current) => ({ ...current, question_type: event.target.value as AdminQuestionType }))
                  }
                  required
                >
                  <option value="single_choice">single_choice</option>
                  <option value="multiple_choice">multiple_choice</option>
                </select>
              </label>
              <Input
                id={`question-order-${editingQuestion.question_id}`}
                label="Порядок *"
                type="number"
                min={1}
                step={1}
                value={editValues.order}
                onChange={(event) => setEditValues((current) => ({ ...current, order: event.target.value }))}
                error={editErrors.order}
                required
              />
              <div className="actions-row admin-action-bar">
                <Button variant="ghost" type="button" onClick={closeEdit}>
                  Отмена
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => handleDelete(editingQuestion.question_id)}
                  disabled={updateQuestionMutation.isPending || deleteQuestionMutation.isPending}
                >
                  {deleteQuestionMutation.isPending ? 'Удаление...' : 'Удалить'}
                </Button>
                <Button type="submit" disabled={updateQuestionMutation.isPending || deleteQuestionMutation.isPending}>
                  {updateQuestionMutation.isPending ? 'Сохранение...' : 'Сохранить'}
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
