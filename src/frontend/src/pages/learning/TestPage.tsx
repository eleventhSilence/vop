import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { testingApi } from '@/entities/testing/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { Toast } from '@/shared/ui/Toast';

const getAttemptStatusLabel = (status?: string) => status === 'in_progress' ? 'Активна' : status === 'completed' ? 'Завершена' : status === 'interrupted' ? 'Прервана' : 'Неизвестный статус';


type AttemptAnswerPayload =
  | {
      question_id: string;
      selected_option_id: string;
    }
  | {
      question_id: string;
      selected_option_ids: string[];
    };

export const TestPage = () => {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isTestVisible, setIsTestVisible] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [localActiveAttemptId, setLocalActiveAttemptId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const queryClient = useQueryClient();

  const testQuery = useQuery({ queryKey: ['testing', 'my-course', courseId], queryFn: () => testingApi.myCourseTest(courseId), enabled: Boolean(courseId) });
  const activeAttemptQuery = useQuery({ queryKey: ['testing', 'active', testQuery.data?.test_id], queryFn: () => testingApi.activeAttempt(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });
  const attemptsQuery = useQuery({ queryKey: ['testing', 'attempts', testQuery.data?.test_id], queryFn: () => testingApi.attempts(testQuery.data?.test_id ?? ''), enabled: Boolean(testQuery.data?.test_id) });
  const attemptDetailQuery = useQuery({ queryKey: ['testing', 'attempt-detail', selectedAttemptId], queryFn: () => testingApi.attemptDetail(selectedAttemptId ?? ''), enabled: Boolean(selectedAttemptId) });

  const startMutation = useMutation({ mutationFn: () => testingApi.startAttempt(testQuery.data?.test_id ?? ''), onSuccess: async (d) => { setLocalActiveAttemptId(d.attempt_id); setAttemptId(d.attempt_id); setIsTestVisible(true); await queryClient.invalidateQueries({ queryKey: ['testing', 'attempts', testQuery.data?.test_id] }); await queryClient.invalidateQueries({ queryKey: ['testing', 'active', testQuery.data?.test_id] }); }, onError: (error) => { const message = extractApiError(error).toLowerCase(); if (message.includes('max attempts exceeded')) { setToast({ type: 'error', message: 'Лимит попыток исчерпан. Повторное прохождение недоступно.' }); } } });
  const submitMutation = useMutation({ mutationFn: (payload: unknown[]) => testingApi.submit(testQuery.data?.test_id ?? '', payload, attemptId ?? undefined), onSuccess: async () => { setToast({ type: 'success', message: 'Попытка успешно завершена.' }); setLocalActiveAttemptId(null); setAttemptId(null); setIsTestVisible(false); setAnswers({}); await attemptsQuery.refetch(); await activeAttemptQuery.refetch(); }, onError: (error) => { const message = extractApiError(error).toLowerCase(); if (message.includes('max attempts exceeded')) { setToast({ type: 'error', message: 'Лимит попыток исчерпан. Повторное прохождение недоступно.' }); return; } setToast({ type: 'error', message: 'Не удалось отправить попытку. Попробуйте ещё раз.' }); } });
  const interruptMutation = useMutation({ mutationFn: (payload: unknown[]) => testingApi.interruptAttempt(attemptId ?? '', payload), onSuccess: async () => { setToast({ type: 'success', message: 'Попытка прервана.' }); setLocalActiveAttemptId(null); setAttemptId(null); setIsTestVisible(false); setAnswers({}); await attemptsQuery.refetch(); await activeAttemptQuery.refetch(); navigate(returnTo); }, onError: () => { setToast({ type: 'error', message: 'Не удалось завершить попытку. Попробуйте ещё раз.' }); } });

  const attempts = attemptsQuery.data ? ensurePaginated(attemptsQuery.data).results : [];
  const submitPayload = useMemo(() => testQuery.data?.questions.map((q) => q.question_type === 'single_choice' ? { question_id: q.question_id, selected_option_id: (answers[q.question_id] ?? [])[0] } : { question_id: q.question_id, selected_option_ids: answers[q.question_id] ?? [] }) ?? [], [answers, testQuery.data?.questions]);
  const interruptPayload = useMemo<AttemptAnswerPayload[]>(() => { const payload: AttemptAnswerPayload[] = []; for (const question of testQuery.data?.questions ?? []) { const selected = answers[question.question_id] ?? []; if (selected.length === 0) { continue; } if (question.question_type === 'single_choice') { payload.push({ question_id: question.question_id, selected_option_id: selected[0] }); } else { payload.push({ question_id: question.question_id, selected_option_ids: selected }); } } return payload; }, [answers, testQuery.data?.questions]);

  const activeAttemptIdFromQuery = activeAttemptQuery.data?.active_attempt?.attempt_id ?? null;
  const activeAttemptId = localActiveAttemptId ?? activeAttemptIdFromQuery;

  useEffect(() => {
    if (activeAttemptIdFromQuery) {
      setLocalActiveAttemptId(activeAttemptIdFromQuery);
      return;
    }
    setLocalActiveAttemptId(null);
  }, [activeAttemptIdFromQuery]);
  const locationState = (location.state as { from?: string; returnTo?: string } | null) ?? null;
  const fallbackReturnTo = '/account/courses';
  const sourceReturnTo = locationState?.from === 'course-learning'
    ? `/account/courses/${courseId}`
    : locationState?.from === 'my-courses'
      ? '/account/courses'
      : fallbackReturnTo;
  const returnTo = locationState?.returnTo ?? sourceReturnTo;
  const backTarget = returnTo;
  const backLabel = locationState?.from === 'course-learning' ? '← К теории' : '← Мои курсы';
  const finalizedAttempts = attempts.filter((a) => a.status === "completed" || a.status === "interrupted");
  const attemptsUsed = finalizedAttempts.length;
  const attemptsMax = testQuery.data?.max_attempts ?? 0;
  const attemptsLeft = Math.max(attemptsMax - attemptsUsed, 0);
  const passedAttempt = attempts.find((attempt) => attempt.status === 'completed' && attempt.is_passed);
  const testPassed = Boolean(passedAttempt);
  const attemptsLimitReached = attemptsLeft === 0;
  const canStartAttempt = !activeAttemptId && !testPassed && !attemptsLimitReached;
  const showTopBackButton = !isTestVisible && !activeAttemptId;
  const hasActiveAttempt = Boolean(activeAttemptId) || attempts.some((attempt) => attempt.status === 'in_progress');
  const isTakingTest = Boolean(activeAttemptId && isTestVisible);
  const testState = activeAttemptId ? 'active' : testPassed ? 'passed' : attemptsLimitReached ? 'attempts-limit' : 'available';

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  return <PageSection>
    {toast ? <Toast type={toast.type} message={toast.message} /> : null}
    {testQuery.isLoading ? <LoadingState message="Загружаем тест..." /> : null}
    {testQuery.isError ? <ErrorState message={extractApiError(testQuery.error)} /> : null}
    {testQuery.data && !testQuery.data.has_test ? <EmptyState message="Для этого курса тест пока не настроен." /> : null}
    {testQuery.data?.has_test ? <>
      <div className="test-page-stack">
        {showTopBackButton ? <div className="test-back-row"><Link to={backTarget} className="button button--ghost public-course-details-back-link">{backLabel}</Link></div> : null}
        <div className="details-layout"><form className="card card--wide form-stack" onSubmit={(e: FormEvent) => { e.preventDefault(); submitMutation.mutate(submitPayload); }}>
      <h2>{testQuery.data.title}</h2>{!isTakingTest ? <p>{testQuery.data.description}</p> : null}
      {!isTestVisible && testState === 'available' ? <div className="form-stack"><p>После начала тестирования будет создана активная попытка. Пока попытка активна, доступ к теории и подробностям прошлых попыток будет временно ограничен. Если вы покинете тест через элементы интерфейса, попытка будет завершена с текущими ответами, а вопросы без ответа будут оценены в 0 баллов.</p><Button type="button" onClick={() => startMutation.mutate()} disabled={startMutation.isPending || !canStartAttempt}>Начать тестирование</Button></div> : null}
      {!isTestVisible && testState === 'attempts-limit' ? <ErrorState message={`Лимит попыток исчерпан. Вы использовали ${attemptsUsed} из ${attemptsMax} попыток. Повторное прохождение недоступно. Обратитесь к администратору или ответственному за обучение для получения дополнительной попытки.`} /> : null}
      {!isTestVisible && testState === 'passed' ? <div className="form-stack"><p>Тест успешно пройден. Результат сохранён в истории попыток, курс считается завершённым.</p><p>Ваш результат: {passedAttempt?.score ?? 0} из {testQuery.data.questions.length}.</p></div> : null}
      {!isTestVisible && testState === 'active' ? <div className="form-stack"><p>У вас есть незавершённая попытка. Продолжите тестирование или завершите её перед возвратом к теории.</p><Button type="button" onClick={() => { setAttemptId(activeAttemptId); setIsTestVisible(true); }}>Продолжить тестирование</Button></div> : null}
      {isTestVisible ? <>
        {testQuery.data.questions.map((question) => <fieldset key={question.question_id} className="question-block"><legend>{question.order}. {question.text}</legend>{question.options.map((option) => {
          const selected = answers[question.question_id] ?? [];
          return <label key={option.option_id} className="option-row"><input type={question.question_type === 'single_choice' ? 'radio' : 'checkbox'} checked={selected.includes(option.option_id)} onChange={(event) => setAnswers((current) => { if (question.question_type === 'single_choice') return { ...current, [question.question_id]: [option.option_id] }; const next = new Set(current[question.question_id] ?? []); if (event.target.checked) next.add(option.option_id); else next.delete(option.option_id); return { ...current, [question.question_id]: Array.from(next) }; })} /><span>{option.text}</span></label>;
        })}</fieldset>)}
        <Button type="submit" disabled={submitMutation.isPending}>Отправить попытку</Button>
        <Button type="button" variant="ghost" disabled={interruptMutation.isPending} onClick={async () => { if (!window.confirm('Вы действительно хотите вернуться к теории? Активная попытка будет завершена с текущими ответами. Вопросы без ответа будут оценены в 0 баллов.')) return; await interruptMutation.mutateAsync(interruptPayload); }}>Вернуться к теории</Button>
      </> : null}
      {startMutation.isError && !extractApiError(startMutation.error).toLowerCase().includes('max attempts exceeded') ? <ErrorState message={extractApiError(startMutation.error)} /> : null}
    </form><aside className="card"><h3>История попыток</h3>
      {attemptsQuery.isLoading ? <LoadingState message="Загружаем попытки..." /> : null}
      {!attemptsQuery.isLoading && !attempts.length ? <EmptyState message="Вы ещё не отправляли попытки по этому тесту." /> : null}
      <div className="stack-list">{attempts.map((attempt) => {
        const isDetailsDisabled = hasActiveAttempt || attempt.status === 'in_progress';
        return <div key={attempt.attempt_id} className="list-item"><strong>Попытка #{attempt.attempt_number}</strong><p>Статус: {getAttemptStatusLabel(attempt.status)}</p><p>Результат: {attempt.status === 'in_progress' ? 'ещё не рассчитан' : `${attempt.score} из ${testQuery.data.questions.length}`}</p>{attempt.status !== 'in_progress' ? <Button type="button" variant="secondary" disabled={isDetailsDisabled} title={isDetailsDisabled ? 'Подробности доступны после завершения активной попытки.' : undefined} onClick={() => setSelectedAttemptId(attempt.attempt_id)}>Подробнее</Button> : null}</div>;
      })}</div>
    </aside></div></div></> : null}

    {selectedAttemptId ? <div className="overlay" role="dialog" aria-modal="true"><div className="overlay__backdrop" onClick={() => setSelectedAttemptId(null)} /><div className="overlay__panel card"><div className="card__row"><h3>Детали попытки</h3><Button type="button" variant="ghost" onClick={() => setSelectedAttemptId(null)}>Закрыть</Button></div>
      {attemptDetailQuery.isLoading ? <LoadingState message="Загружаем детали..." /> : null}
      {attemptDetailQuery.isError ? <ErrorState message={extractApiError(attemptDetailQuery.error)} /> : null}
      {attemptDetailQuery.data ? <div className="form-stack"><p>Попытка #{attemptDetailQuery.data.attempt_number} · {new Date(attemptDetailQuery.data.created_at).toLocaleString()} · Статус: {getAttemptStatusLabel((attemptDetailQuery.data as { status?: string }).status)} · Баллы: {attemptDetailQuery.data.score} · {attemptDetailQuery.data.percent}%</p>{attemptDetailQuery.data.questions.map((q) => <div key={q.question_id} className="question-block"><strong>{q.order}. {q.text}</strong><p>{q.result === 'unanswered' ? 'Без ответа (0 баллов)' : q.result === 'success' ? 'Ответ верный' : 'Ответ содержит ошибки (0 баллов)'}</p>{q.selected_options.length === 0 ? <p className="muted">Без ответа</p> : q.selected_options.map((o) => <div key={o.option_id} className={`attempt-option attempt-option--${o.status}`}>{o.text}</div>)}</div>)}</div> : null}
    </div></div> : null}
  </PageSection>;
};
