import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const TestPage = () => {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isTestVisible, setIsTestVisible] = useState(false);

  const testQuery = useQuery({ queryKey: ['testing', 'my-course', courseId], queryFn: () => testingApi.myCourseTest(courseId), enabled: Boolean(courseId) });
  const activeAttemptQuery = useQuery({ queryKey: ['testing', 'active', testQuery.data?.test_id], queryFn: () => testingApi.activeAttempt(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });
  const attemptsQuery = useQuery({ queryKey: ['testing', 'attempts', testQuery.data?.test_id], queryFn: () => testingApi.attempts(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });

  const startMutation = useMutation({ mutationFn: () => testingApi.startAttempt(testQuery.data?.test_id ?? ''), onSuccess: (d) => { setAttemptId(d.attempt_id); setIsTestVisible(true); } });
  const submitMutation = useMutation({ mutationFn: (payload: unknown[]) => testingApi.submit(testQuery.data?.test_id ?? '', payload, attemptId ?? undefined), onSuccess: async () => { setAttemptId(null); setIsTestVisible(false); await attemptsQuery.refetch(); await activeAttemptQuery.refetch(); } });
  const interruptMutation = useMutation({ mutationFn: (payload: unknown[]) => testingApi.interruptAttempt(attemptId ?? '', payload), onSuccess: async () => { setAttemptId(null); setIsTestVisible(false); await attemptsQuery.refetch(); await activeAttemptQuery.refetch(); } });

  const attempts = attemptsQuery.data ? ensurePaginated(attemptsQuery.data).results : [];
  const submitPayload = useMemo(() => testQuery.data?.questions.map((q) => q.question_type === 'single_choice' ? { question_id: q.question_id, selected_option_id: (answers[q.question_id] ?? [])[0] } : { question_id: q.question_id, selected_option_ids: answers[q.question_id] ?? [] }) ?? [], [answers, testQuery.data?.questions]);

  const activeAttemptId = activeAttemptQuery.data?.active_attempt?.attempt_id;

  return <PageSection>
    {testQuery.isLoading ? <LoadingState message="Загружаем тест..." /> : null}
    {testQuery.isError ? <ErrorState message={extractApiError(testQuery.error)} /> : null}
    {testQuery.data && !testQuery.data.has_test ? <EmptyState message="Для этого курса тест пока не настроен." /> : null}

    {testQuery.data?.has_test ? <div className="details-layout"><form className="card card--wide form-stack" onSubmit={(e: FormEvent) => { e.preventDefault(); submitMutation.mutate(submitPayload); }}>
      <h2>{testQuery.data.title}</h2><p>{testQuery.data.description}</p>
      {!isTestVisible && !activeAttemptId ? <div className="form-stack"><p>После начала тестирования будет создана активная попытка...</p><Button type="button" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>Начать тестирование</Button></div> : null}
      {!isTestVisible && activeAttemptId ? <div className="form-stack"><p>У вас есть незавершённая попытка.</p><Button type="button" onClick={() => { setAttemptId(activeAttemptId); setIsTestVisible(true); }}>Продолжить тестирование</Button></div> : null}
      {isTestVisible ? <>
        {testQuery.data.questions.map((question) => <fieldset key={question.question_id} className="question-block"><legend>{question.order}. {question.text}</legend>{question.options.map((option) => {
          const selected = answers[question.question_id] ?? [];
          const checked = selected.includes(option.option_id);
          return <label key={option.option_id} className="option-row"><input type={question.question_type === 'single_choice' ? 'radio' : 'checkbox'} name={question.question_id} checked={checked} onChange={(event) => setAnswers((current) => { if (question.question_type === 'single_choice') return { ...current, [question.question_id]: [option.option_id] }; const next = new Set(current[question.question_id] ?? []); if (event.target.checked) next.add(option.option_id); else next.delete(option.option_id); return { ...current, [question.question_id]: Array.from(next) }; })} /><span>{option.text}</span></label>;
        })}</fieldset>)}
        <Button type="submit" disabled={submitMutation.isPending}>Отправить попытку</Button>
        <Button type="button" variant="ghost" onClick={() => { if (window.confirm('Вы действительно хотите покинуть тест? Активная попытка будет завершена с текущими ответами.')) { interruptMutation.mutate(submitPayload); navigate(`/account/courses/${courseId}/learn`); } }}>Вернуться к теории</Button>
      </> : null}
      {submitMutation.isSuccess ? <SuccessState message={`Попытка #${submitMutation.data.attempt_number}: ${submitMutation.data.score} баллов.`} /> : null}
      {submitMutation.isError ? <ErrorState message={extractApiError(submitMutation.error)} /> : null}
    </form><aside className="card"><h3>История попыток</h3>{attempts.map((attempt) => <div key={attempt.attempt_id} className="list-item"><strong>Попытка #{attempt.attempt_number}</strong><p>Статус: {attempt.status}</p><p>Результат: {attempt.score}</p></div>)}</aside></div> : null}
  </PageSection>;
};
