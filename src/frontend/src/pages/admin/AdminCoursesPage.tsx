import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '@/entities/course/api';
import { extractApiError } from '@/shared/api/client';
import { formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const AdminCoursesPage = () => {
  const coursesQuery = useQuery({ queryKey: ['admin', 'courses'], queryFn: () => coursesApi.adminList() });
  const courses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

  return (
    <PageSection>
      <h2>Администратор: курсы</h2>
      <p className="muted">Lifecycle курсов опирается на поле <code>status</code>, без delete-flow.</p>
      {coursesQuery.isLoading ? <LoadingState /> : null}
      {coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}
      <div className="stack-list">
        {courses.map((course) => (
          <div className="card" key={course.course_id}>
            <div className="card__row"><h3>{course.title}</h3><span>{formatStatus(course.status)}</span></div>
            <p>{course.short_description}</p>
            <p className="muted">{course.description}</p>
          </div>
        ))}
      </div>
    </PageSection>
  );
};
