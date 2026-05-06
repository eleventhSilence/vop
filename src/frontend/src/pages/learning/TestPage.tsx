import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const TestPage = () => {
  const { courseId = '' } = useParams();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const testQuery = useQuery({
    queryKey: ['testing', 'my-course', courseId],
    queryFn: () => testingApi.myCourseTest(courseId),
    enabled: Boolean(courseId),
  });

  const attemptsQuery = useQuery({
    queryKey: ['testing', 'attempts', testQuery.data?.test_id],
    queryFn: () => testingApi.attempts(testQuery.data?.test_id ?? ''),
    enabled: Boolean(testQuery.data?.test_id),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: unknown[]) => testingApi.submit(testQuery.data?.test_id ?? '', payload),
    onSuccess: async () => {
      if (testQuery.data?.test_id) {
        await attemptsQuery.refetch();
      }
    },
  });

  const attempts = attemptsQuery.data ? ensurePaginated(attemptsQuery.data).results : [];
  const attemptDetailQuery = useQuery({
    queryKey: ['testing', 'attempt-detail', selectedAttemptId],
    queryFn: () => testingApi.attemptDetail(selectedAttemptId ?? ''),
    enabled: Boolean(selectedAttemptId),
  });

  const submitPayload = useMemo(() => {
    return testQuery.data?.questions.map((question) => {
      const selected = answers[question.question_id] ?? [];
      if (question.question_type === 'single_choice') {
        return { question_id: question.question_id, selected_option_id: selected[0] };
      }
      return { question_id: question.question_id, selected_option_ids: selected };
    }) ?? [];
  }, [answers, testQuery.data?.questions]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitMutation.mutate(submitPayload);
  };

  return (
    <PageSection>
      {testQuery.isLoading ? <LoadingState message="Загружаем тест..." /> : null}
      {testQuery.isError ? <ErrorState message={extractApiError(testQuery.error)} /> : null}
      {testQuery.data && !testQuery.data.has_test ? <EmptyState message="Для этого курса тест пока не настроен." /> : null}

      {testQuery.data?.has_test ? (
        <div className="details-layout">
          <form className="card card--wide form-stack" onSubmit={handleSubmit}>
            <div>
              <p className="eyebrow">Тестирование</p>
              <h2>{testQuery.data.title}</h2>
              <p>{testQuery.data.description}</p>
            </div>
            {testQuery.data.questions.map((question) => (
              <fieldset key={question.question_id} className="question-block">
                <legend>{question.order}. {question.text}</legend>
                {question.options.map((option) => {
                  const selected = answers[question.question_id] ?? [];
                  const type = question.question_type === 'single_choice' ? 'radio' : 'checkbox';
                  const checked = selected.includes(option.option_id);
                  return (
                    <label key={option.option_id} className="option-row">
                      <input
                        type={type}
                        name={question.question_id}
                        checked={checked}
                        onChange={(event) => {
                          setAnswers((current) => {
                            if (question.question_type === 'single_choice') {
                              return { ...current, [question.question_id]: [option.option_id] };
                            }

                            const next = new Set(current[question.question_id] ?? []);
                            if (event.target.checked) next.add(option.option_id);
                            else next.delete(option.option_id);
                            return { ...current, [question.question_id]: Array.from(next) };
                          });
                        }}
                      />
                      <span>{option.text}</span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
            <Button type="submit" disabled={submitMutation.isPending}>Отправить попытку</Button>
            {submitMutation.isError ? <ErrorState message={extractApiError(submitMutation.error)} /> : null}
            {submitMutation.isSuccess ? (
              <SuccessState message={`Попытка #${submitMutation.data.attempt_number}: ${submitMutation.data.score} баллов.`} />
            ) : null}
          </form>

          <aside className="card">
            <h3>История попыток</h3>
            {attemptsQuery.isLoading ? <LoadingState message="Загружаем попытки..." /> : null}
            {attemptsQuery.isError ? <ErrorState message={extractApiError(attemptsQuery.error)} /> : null}
            {!attemptsQuery.isLoading && !attemptsQuery.isError && !attempts.length ? <EmptyState message="Вы ещё не отправляли попытки по этому тесту." /> : null}
            <div className="stack-list">
              {attempts.map((attempt) => (
                <div key={attempt.attempt_id} className="list-item">
                  <strong>Попытка #{attempt.attempt_number}</strong>
                  <p>Результат: {attempt.score}</p>
                  <p>{attempt.is_passed ? 'Тест пройден' : 'Тест не пройден'}</p>
                  <Button type="button" variant="secondary" onClick={() => setSelectedAttemptId(attempt.attempt_id)}>
                    Подробнее
                  </Button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {selectedAttemptId ? (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="overlay__backdrop" onClick={() => setSelectedAttemptId(null)} />
          <div className="overlay__panel card">
            <div className="card__row">
              <h3>Детали попытки</h3>
              <Button type="button" variant="ghost" onClick={() => setSelectedAttemptId(null)}>Закрыть</Button>
            </div>
            {attemptDetailQuery.isLoading ? <LoadingState message="Загружаем детали..." /> : null}
            {attemptDetailQuery.isError ? <ErrorState message={extractApiError(attemptDetailQuery.error)} /> : null}
            {attemptDetailQuery.data ? (
              <div className="form-stack">
                <p>
                  Попытка #{attemptDetailQuery.data.attempt_number} · {new Date(attemptDetailQuery.data.created_at).toLocaleString()} ·
                  {' '}Баллы: {attemptDetailQuery.data.score} · {attemptDetailQuery.data.percent}% ·
                  {' '}{attemptDetailQuery.data.is_passed ? 'Сдано' : 'Не сдано'}
                </p>
                <p className="muted">Легенда: <span className="badge badge--success">Ваш верный выбор</span> <span className="badge badge--danger">Ваш неверный выбор</span></p>
                {attemptDetailQuery.data.questions.map((question) => (
                  <div key={question.question_id} className="question-block">
                    <strong>{question.order}. {question.text}</strong>
                    <p>{question.result === 'success' ? 'Ответ верный' : 'Ответ содержит ошибки'}</p>
                    {question.selected_options.map((option) => (
                      <div key={option.option_id} className={`attempt-option attempt-option--${option.status}`}>
                        {option.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </PageSection>
  );
};
