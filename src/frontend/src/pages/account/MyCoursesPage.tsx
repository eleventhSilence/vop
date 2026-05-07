import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import type { MyCoursesProgressFilter } from '@/entities/course/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const MyCoursesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const search = (searchParams.get('search') ?? '').trim();
  const progress = ((searchParams.get('progress') ?? 'all').trim().toLowerCase() || 'all') as MyCoursesProgressFilter;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const trimmedSearch = searchInput.trim();
      const nextSearch = trimmedSearch ? trimmedSearch : null;
      const prevSearch = searchParams.get('search');
      if ((prevSearch ?? null) === nextSearch) {
        return;
      }
      const nextParams = new URLSearchParams(searchParams);
      if (nextSearch) {
        nextParams.set('search', nextSearch);
      } else {
        nextParams.delete('search');
      }
      setSearchParams(nextParams);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchInput, searchParams, setSearchParams]);

  const coursesQuery = useQuery({
    queryKey: ['courses', 'my', search, progress],
    queryFn: () => coursesApi.myCourses({ search, progress }),
  });

  const courses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

  const setProgress = (nextProgress: MyCoursesProgressFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextProgress === 'all') {
      nextParams.delete('progress');
    } else {
      nextParams.set('progress', nextProgress);
    }
    setSearchParams(nextParams);
  };

  return (
    <PageSection>
      <div className="section-header"><div><p className="eyebrow">Обучение</p><h2>Мои курсы</h2></div></div>
      <div className="card courses-filters">
        <label className="field courses-filters__field" htmlFor="my-courses-search">
          <span className="field__label">Поиск</span>
          <input
            id="my-courses-search"
            className="field__control"
            placeholder="Поиск по моим курсам"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <label className="field courses-filters__field" htmlFor="my-courses-progress">
          <span className="field__label">Прогресс</span>
          <select id="my-courses-progress" className="field__control" value={progress} onChange={(event) => setProgress(event.target.value as MyCoursesProgressFilter)}>
            <option value="all">Любой прогресс</option>
            <option value="25">25%</option>
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
          </select>
        </label>
      </div>
      {coursesQuery.isLoading ? <LoadingState message="Загружаем ваши курсы..." /> : null}
      {coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}
      {!coursesQuery.isLoading && !coursesQuery.isError && !courses.length ? <EmptyState message={search || progress !== 'all' ? 'Курсы не найдены.' : 'У вас пока нет записанных курсов.'} /> : null}
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
