import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { progressApi } from '@/entities/progress/api';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime, formatStatus } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const CourseLearningPage = () => {
  const { courseId = '' } = useParams();
  const courseQuery = useQuery({
    queryKey: ['courses', 'my-detail', courseId],
    queryFn: () => coursesApi.myDetail(courseId),
    enabled: Boolean(courseId),
  });
  const progressQuery = useQuery({
    queryKey: ['progress', 'course', courseId],
    queryFn: () => progressApi.courseProgress(courseId),
    enabled: Boolean(courseId),
  });
  const completeTheoryMutation = useMutation({
    mutationFn: () => progressApi.completeTheory(courseId),
    onSuccess: async () => {
      await progressQuery.refetch();
    },
  });

  return (
    <PageSection>
      {(courseQuery.isLoading || progressQuery.isLoading) ? <LoadingState /> : null}
      {courseQuery.isError ? <ErrorState message={extractApiError(courseQuery.error)} /> : null}
      {progressQuery.isError ? <ErrorState message={extractApiError(progressQuery.error)} /> : null}
      {courseQuery.data && progressQuery.data ? (
        <div className="details-layout">
          <article className="card card--wide">
            <h2>{courseQuery.data.title}</h2>
            <p className="lead">{courseQuery.data.short_description}</p>
            <div className="prose-block">{courseQuery.data.content}</div>
          </article>
          <aside className="card">
            <h3>Прогресс</h3>
            <p>Статус: {formatStatus(progressQuery.data.progress_status)}</p>
            <p>Выполнено: {progressQuery.data.progress_percent}%</p>
            <p>Теория завершена: {progressQuery.data.is_theory_completed ? 'Да' : 'Нет'}</p>
            <p>Дата завершения теории: {formatDateTime(progressQuery.data.theory_completed_at)}</p>
            <p>Попыток теста: {progressQuery.data.total_attempts}</p>
            <Button onClick={() => completeTheoryMutation.mutate()} disabled={completeTheoryMutation.isPending || progressQuery.data.is_theory_completed} fullWidth>
              {progressQuery.data.is_theory_completed ? 'Теория отмечена как завершённая' : 'Завершить теорию'}
            </Button>
            <Link to={`/account/courses/${courseId}/test`} className="text-link">Перейти к тестированию →</Link>
          </aside>
        </div>
      ) : null}
    </PageSection>
  );
};
