import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

const getAttemptStatusLabel = (status?: string) => status === 'in_progress' ? 'Активна' : status === 'completed' ? 'Завершена' : status === 'interrupted' ? 'Прервана' : 'Неизвестный статус';

export const TestPage = () => {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isTestVisible, setIsTestVisible] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const testQuery = useQuery({ queryKey: ['testing', 'my-course', courseId], queryFn: () => testingApi.myCourseTest(courseId), enabled: Boolean(courseId) });
  const activeAttemptQuery = useQuery({ queryKey: ['testing', 'active', testQuery.data?.test_id], queryFn: () => testingApi.activeAttempt(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });
  const attemptsQuery = useQuery({ queryKey: ['testing', 'attempts', testQuery.data?.test_id], queryFn: () => testingApi.attempts(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });
  const attemptDetailQuery = useQuery({ queryKey: ['testing', 'attempt-detail', selectedAttemptId], queryFn: () => testingApi.attemptDetail(selectedAttemptId ?? ''), enabled: Boolean(selectedAttemptId) });

  const startMutation = useMutation({ mutationFn: () => testingApi.startAttempt(testQuery.data?.test_id ?? ''), onSuccess: (d) => { setAttemptId(d.attempt_id); setIsTestVisible(true); } });
  const submitMutation = useMutation({ mutationFn: (payload: unknown[]) => testingApi.submit(testQuery.data?.test_id ?? '', payload, attemptId ?? undefined), onSuccess: async () => { setAttemptId(null); setIsTestVisible(false); setAnswers({}); await attemptsQuery.refetch(); await activeAttemptQuery.refetch(); } });
  const interruptMutation = useMutation({ mutationFn: (payload: unknown[]) => testingApi.interruptAttempt(attemptId ?? '', payload), onSuccess: async () => { setAttemptId(null); setIsTestVisible(false); setAnswers({}); await attemptsQuery.refetch(); await activeAttemptQuery.refetch(); navigate(`/account/courses/${courseId}`); } });

  const attempts = attemptsQuery.data ? ensurePaginated(attemptsQuery.data).results : [];
  const submitPayload = useMemo(() => testQuery.data?.questions.map((q) => q.question_type === 'single_choice' ? { question_id: q.question_id, selected_option_id: (answers[q.question_id] ?? [])[0] } : { question_id: q.question_id, selected_option_ids: answers[q.question_id] ?? [] }) ?? [], [answers, testQuery.data?.questions]);
  const interruptPayload = useMemo(() => (testQuery.data?.questions ?? []).flatMap((q) => { const selected = answers[q.question_id] ?? []; if (selected.length === 0) return []; return q.question_type === 'single_choice' ? [{ question_id: q.question_id, selected_option_id: selected[0] }] : [{ question_id: q.question_id, selected_option_ids: selected }]; }), [answers, testQuery.data?.questions]);

  const activeAttemptId = activeAttemptQuery.data?.active_attempt?.attempt_id;

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
          return <label key={option.option_id} className="option-row"><input type={question.question_type === 'single_choice' ? 'radio' : 'checkbox'} checked={selected.includes(option.option_id)} onChange={(event) => setAnswers((current) => { if (question.question_type === 'single_choice') return { ...current, [question.question_id]: [option.option_id] }; const next = new Set(current[question.question_id] ?? []); if (event.target.checked) next.add(option.option_id); else next.delete(option.option_id); return { ...current, [question.question_id]: Array.from(next) }; })} /><span>{option.text}</span></label>;
        })}</fieldset>)}
        <Button type="submit" disabled={submitMutation.isPending}>Отправить попытку</Button>
        <Button type="button" variant="ghost" disabled={interruptMutation.isPending} onClick={async () => { if (!window.confirm('Вы действительно хотите покинуть тест? Активная попытка будет завершена с текущими ответами. Вопросы без ответа будут оценены в 0 баллов.')) return; await interruptMutation.mutateAsync(interruptPayload); }}>Вернуться к теории</Button>
      </> : null}
      {submitMutation.isSuccess ? <SuccessState message="Попытка успешно завершена." /> : null}
      {submitMutation.isError ? <ErrorState message={extractApiError(submitMutation.error)} /> : null}
      {interruptMutation.isError ? <ErrorState message={extractApiError(interruptMutation.error)} /> : null}
    </form><aside className="card"><h3>История попыток</h3>
      {attemptsQuery.isLoading ? <LoadingState message="Загружаем попытки..." /> : null}
      {!attemptsQuery.isLoading && !attempts.length ? <EmptyState message="Вы ещё не отправляли попытки по этому тесту." /> : null}
      {attempts.map((attempt) => <div key={attempt.attempt_id} className="list-item"><strong>Попытка #{attempt.attempt_number}</strong><p>Статус: {getAttemptStatusLabel(attempt.status)}</p><p>Результат: {attempt.status === 'in_progress' ? 'ещё не рассчитан' : `${attempt.score} из ${testQuery.data.questions.length}`}</p>{attempt.status !== 'in_progress' ? <Button type="button" variant="secondary" onClick={() => setSelectedAttemptId(attempt.attempt_id)}>Подробнее</Button> : null}</div>)}
    </aside></div> : null}

    {selectedAttemptId ? <div className="overlay" role="dialog" aria-modal="true"><div className="overlay__backdrop" onClick={() => setSelectedAttemptId(null)} /><div className="overlay__panel card"><div className="card__row"><h3>Детали попытки</h3><Button type="button" variant="ghost" onClick={() => setSelectedAttemptId(null)}>Закрыть</Button></div>
      {attemptDetailQuery.isLoading ? <LoadingState message="Загружаем детали..." /> : null}
      {attemptDetailQuery.isError ? <ErrorState message={extractApiError(attemptDetailQuery.error)} /> : null}
      {attemptDetailQuery.data ? <div className="form-stack"><p>Попытка #{attemptDetailQuery.data.attempt_number} · {new Date(attemptDetailQuery.data.created_at).toLocaleString()} · Статус: {getAttemptStatusLabel((attemptDetailQuery.data as { status?: string }).status)} · Баллы: {attemptDetailQuery.data.score} · {attemptDetailQuery.data.percent}%</p>{attemptDetailQuery.data.questions.map((q) => <div key={q.question_id} className="question-block"><strong>{q.order}. {q.text}</strong><p>{q.result === 'unanswered' ? 'Без ответа (0 баллов)' : q.result === 'success' ? 'Ответ верный' : 'Ответ содержит ошибки (0 баллов)'}</p>{q.selected_options.length === 0 ? <p className="muted">Без ответа</p> : q.selected_options.map((o) => <div key={o.option_id} className={`attempt-option attempt-option--${o.status}`}>{o.text}</div>)}</div>)}</div> : null}
    </div></div> : null}
  </PageSection>;
};
