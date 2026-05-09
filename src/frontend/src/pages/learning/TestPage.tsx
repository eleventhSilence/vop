import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

const getAttemptStatusLabel = (status?: string) => {
  if (status === 'in_progress') return 'Активна';
  if (status === 'completed') return 'Завершена';
  if (status === 'interrupted') return 'Прервана';
  return 'Неизвестный статус';
};

export const TestPage = () => {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isTestVisible, setIsTestVisible] = useState(false);
  const [resultSummary, setResultSummary] = useState<{ attemptNumber: number; score: number; status: string; isPassed: boolean } | null>(null);

  const testQuery = useQuery({ queryKey: ['testing', 'my-course', courseId], queryFn: () => testingApi.myCourseTest(courseId), enabled: Boolean(courseId) });
  const activeAttemptQuery = useQuery({ queryKey: ['testing', 'active', testQuery.data?.test_id], queryFn: () => testingApi.activeAttempt(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });
  const attemptsQuery = useQuery({ queryKey: ['testing', 'attempts', testQuery.data?.test_id], queryFn: () => testingApi.attempts(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });

  const startMutation = useMutation({ mutationFn: () => testingApi.startAttempt(testQuery.data?.test_id ?? ''), onSuccess: (d) => { setAttemptId(d.attempt_id); setIsTestVisible(true); setResultSummary(null); } });
  const submitMutation = useMutation({
    mutationFn: (payload: unknown[]) => testingApi.submit(testQuery.data?.test_id ?? '', payload, attemptId ?? undefined),
    onSuccess: async (data) => {
      setAttemptId(null);
      setIsTestVisible(false);
      setAnswers({});
      setResultSummary({ attemptNumber: data.attempt_number, score: data.score, status: 'completed', isPassed: data.is_passed });
      await attemptsQuery.refetch();
      await activeAttemptQuery.refetch();
    },
  });
  const interruptMutation = useMutation({
    mutationFn: (payload: unknown[]) => testingApi.interruptAttempt(attemptId ?? '', payload),
    onSuccess: async (data) => {
      setAttemptId(null);
      setIsTestVisible(false);
      setAnswers({});
      setResultSummary({ attemptNumber: data.attempt_number, score: data.score, status: 'interrupted', isPassed: data.is_passed });
      await attemptsQuery.refetch();
      await activeAttemptQuery.refetch();
      navigate(`/account/courses/${courseId}`);
    },
  });

  const attempts = attemptsQuery.data ? ensurePaginated(attemptsQuery.data).results : [];
  const submitPayload = useMemo(() => testQuery.data?.questions.map((q) => q.question_type === 'single_choice' ? { question_id: q.question_id, selected_option_id: (answers[q.question_id] ?? [])[0] } : { question_id: q.question_id, selected_option_ids: answers[q.question_id] ?? [] }) ?? [], [answers, testQuery.data?.questions]);

  const activeAttemptId = activeAttemptQuery.data?.active_attempt?.attempt_id;

  const handleInterrupt = async () => {
    if (!window.confirm('Вы действительно хотите покинуть тест? Активная попытка будет завершена с текущими ответами. Вопросы без ответа будут оценены в 0 баллов.')) return;
    await interruptMutation.mutateAsync(submitPayload);
  };

  return <PageSection>
    {testQuery.isLoading ? <LoadingState message="Загружаем тест..." /> : null}
    {testQuery.isError ? <ErrorState message={extractApiError(testQuery.error)} /> : null}
    {testQuery.data && !testQuery.data.has_test ? <EmptyState message="Для этого курса тест пока не настроен." /> : null}

    {testQuery.data?.has_test ? <div className="details-layout"><form className="card card--wide form-stack" onSubmit={(e: FormEvent) => { e.preventDefault(); submitMutation.mutate(submitPayload); }}>
      <h2>{testQuery.data.title}</h2><p>{testQuery.data.description}</p>
      {!isTestVisible && !activeAttemptId ? <div className="form-stack"><p>После начала тестирования будет создана активная попытка. Пока попытка активна, доступ к теории будет временно ограничен. Если вы покинете тест через элементы интерфейса, попытка будет завершена с текущими ответами, а вопросы без ответа будут оценены в 0 баллов.</p><Button type="button" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>Начать тестирование</Button></div> : null}
      {!isTestVisible && activeAttemptId ? <div className="form-stack"><p>У вас есть незавершённая попытка. Продолжите тестирование или завершите её перед возвратом к теории.</p><Button type="button" onClick={() => { setAttemptId(activeAttemptId); setIsTestVisible(true); }}>Продолжить тестирование</Button></div> : null}
      {isTestVisible ? <>
        {testQuery.data.questions.map((question) => <fieldset key={question.question_id} className="question-block"><legend>{question.order}. {question.text}</legend>{question.options.map((option) => {
          const selected = answers[question.question_id] ?? [];
          const checked = selected.includes(option.option_id);
          return <label key={option.option_id} className="option-row"><input type={question.question_type === 'single_choice' ? 'radio' : 'checkbox'} name={question.question_id} checked={checked} onChange={(event) => setAnswers((current) => { if (question.question_type === 'single_choice') return { ...current, [question.question_id]: [option.option_id] }; const next = new Set(current[question.question_id] ?? []); if (event.target.checked) next.add(option.option_id); else next.delete(option.option_id); return { ...current, [question.question_id]: Array.from(next) }; })} /><span>{option.text}</span></label>;
        })}</fieldset>)}
        <Button type="submit" disabled={submitMutation.isPending}>Отправить попытку</Button>
        <Button type="button" variant="ghost" disabled={interruptMutation.isPending} onClick={handleInterrupt}>Вернуться к теории</Button>
      </> : null}
      {submitMutation.isError ? <ErrorState message={extractApiError(submitMutation.error)} /> : null}
      {interruptMutation.isError ? <ErrorState message={extractApiError(interruptMutation.error)} /> : null}
      {resultSummary ? <SuccessState message={`Попытка #${resultSummary.attemptNumber}. Статус: ${getAttemptStatusLabel(resultSummary.status)}. Результат: ${resultSummary.score} из ${testQuery.data.questions.length}. ${resultSummary.isPassed ? 'Тест пройден.' : 'Тест не пройден.'}`} /> : null}
    </form><aside className="card"><h3>История попыток</h3>
      {attemptsQuery.isLoading ? <LoadingState message="Загружаем попытки..." /> : null}
      {attemptsQuery.isError ? <ErrorState message={extractApiError(attemptsQuery.error)} /> : null}
      {!attemptsQuery.isLoading && !attemptsQuery.isError && attempts.length === 0 ? <EmptyState message="Вы ещё не отправляли попытки по этому тесту." /> : null}
      {attempts.map((attempt) => <div key={attempt.attempt_id} className="list-item"><strong>Попытка #{attempt.attempt_number}</strong><p>Статус: {getAttemptStatusLabel(attempt.status)}</p><p>Результат: {attempt.status === 'in_progress' ? 'ещё не рассчитан' : `${attempt.score} из ${testQuery.data.questions.length}`}</p><p>Дата: {new Date(attempt.created_at).toLocaleString()}</p><p>{attempt.is_passed ? 'Тест пройден' : 'Тест не пройден'}</p></div>)}
    </aside></div> : null}
  </PageSection>;
};
