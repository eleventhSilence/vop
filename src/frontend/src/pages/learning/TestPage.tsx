import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const TestPage = () => {
  const { courseId = '' } = useParams();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const testQuery = useQuery({
    queryKey: ['testing', 'course', courseId],
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
      {testQuery.isLoading ? <LoadingState /> : null}
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
            {submitMutation.isError ? <div className="form-error">{extractApiError(submitMutation.error)}</div> : null}
            {submitMutation.isSuccess ? (
              <div className="form-success">
                Попытка #{submitMutation.data.attempt_number}: {submitMutation.data.score} баллов.
              </div>
            ) : null}
          </form>

          <aside className="card">
            <h3>История попыток</h3>
            {attemptsQuery.isLoading ? <LoadingState message="Загружаем попытки..." /> : null}
            {attemptsQuery.isError ? <ErrorState message={extractApiError(attemptsQuery.error)} /> : null}
            <div className="stack-list">
              {attempts.map((attempt) => (
                <div key={attempt.attempt_id} className="list-item">
                  <strong>Попытка #{attempt.attempt_number}</strong>
                  <p>Результат: {attempt.score}</p>
                  <p>{attempt.is_passed ? 'Тест пройден' : 'Тест не пройден'}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </PageSection>
  );
};
