import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';

const PAGE_SIZE = 6;

export const CoursesListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPageParam = Number(searchParams.get('page') ?? '1');
  const currentPage = Number.isFinite(currentPageParam) && currentPageParam > 0 ? currentPageParam : 1;

  const coursesQuery = useQuery({
    queryKey: ['courses', 'public', currentPage],
    queryFn: () => coursesApi.list({ page: currentPage, page_size: PAGE_SIZE }),
  });

  const paginatedCourses = coursesQuery.data ? ensurePaginated(coursesQuery.data) : null;
  const courses = paginatedCourses?.results ?? [];
  const totalPages = paginatedCourses ? Math.max(1, Math.ceil(paginatedCourses.count / PAGE_SIZE)) : 1;

  const setPage = (page: number) => {
    setSearchParams(page <= 1 ? {} : { page: String(page) });
  };

  return (
    <PageSection className="public-page-stack">
      <div className="section-header public-section-header">
        <div>
          <p className="eyebrow">Каталог курсов</p>
          <h2>Открытые учебные программы платформы</h2>
          <p className="muted public-section-header__text">
            Страница использует существующий публичный endpoint <code>/api/courses/</code> и показывает курсы как основную
            точку входа в образовательную часть системы.
          </p>
        </div>
        <div className="card public-summary-card">
          <strong>{paginatedCourses?.count ?? '—'}</strong>
          <span className="muted">курсов доступно в каталоге</span>
        </div>
      </div>

      {coursesQuery.isLoading ? <LoadingState message="Загружаем каталог курсов..." /> : null}
      {coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}
      {!coursesQuery.isLoading && !coursesQuery.isError && !courses.length ? (
        <EmptyState message="Пока в каталоге нет курсов. Когда материалы появятся, они будут показаны здесь." />
      ) : null}

      <div className="card-grid public-courses-grid">
        {courses.map((course) => (
          <article key={course.course_id} className="card public-course-card">
            <div className="stack-list public-course-card__content">
              <div className="card__row public-course-card__header">
                <h3>{course.title}</h3>
                <StatusBadge status="available" label="Открытый курс" tone="default" />
              </div>
              <p className="muted">{course.short_description || 'Описание курса будет добавлено позднее.'}</p>
            </div>

            <div className="public-course-card__footer">
              <Link to={`/courses/${course.course_id}`} className="button button--secondary">
                Перейти к курсу
              </Link>
            </div>
          </article>
        ))}
      </div>

      {paginatedCourses && totalPages > 1 ? (
        <div className="card public-pagination-card">
          <div>
            <p className="eyebrow">Навигация по каталогу</p>
            <p className="muted">
              Страница {currentPage} из {totalPages}
            </p>
          </div>

          <div className="hero-card__actions">
            <button type="button" className="button button--ghost" onClick={() => setPage(currentPage - 1)} disabled={!paginatedCourses.previous}>
              Предыдущая
            </button>
            <button type="button" className="button button--primary" onClick={() => setPage(currentPage + 1)} disabled={!paginatedCourses.next}>
              Следующая
            </button>
          </div>
        </div>
      ) : null}
    </PageSection>
  );
};
