import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const MyCoursesPage = () => {
  const coursesQuery = useQuery({
    queryKey: ['courses', 'my'],
    queryFn: coursesApi.myCourses,
  });

  const courses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

  return (
    <PageSection>
      <div className="section-header"><div><p className="eyebrow">Обучение</p><h2>Мои курсы</h2></div></div>
      {coursesQuery.isLoading ? <LoadingState /> : null}
      {coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}
      {!coursesQuery.isLoading && !courses.length ? <EmptyState message="У вас пока нет записанных курсов." /> : null}
      <div className="stack-list">
        {courses.map((course) => (
          <div className="card" key={course.course_id}>
            <div className="card__row">
              <div>
                <h3>{course.title}</h3>
                <p>{course.short_description}</p>
              </div>
              <strong>{course.progress_percent}%</strong>
            </div>
            <div className="card__row">
              <Link to={`/account/courses/${course.course_id}`} className="text-link">Учебная страница →</Link>
              <Link to={`/account/courses/${course.course_id}/test`} className="text-link">Тестирование →</Link>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
};
