import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const CoursesListPage = () => {
  const coursesQuery = useQuery({
    queryKey: ['courses', 'public'],
    queryFn: () => coursesApi.list(),
  });

  const courses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

  return (
    <PageSection>
      <div className="section-header">
        <div>
          <p className="eyebrow">Публичная часть</p>
          <h2>Каталог курсов</h2>
          <p>Страница использует существующий paginated endpoint <code>/api/courses/</code>.</p>
        </div>
      </div>

      {coursesQuery.isLoading ? <LoadingState /> : null}
      {coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}

      <div className="card-grid">
        {courses.map((course) => (
          <article key={course.course_id} className="card">
            <div>
              <h3>{course.title}</h3>
              <p>{course.short_description}</p>
            </div>
            <Link to={`/courses/${course.course_id}`} className="text-link">
              Подробнее →
            </Link>
          </article>
        ))}
      </div>
    </PageSection>
  );
};
