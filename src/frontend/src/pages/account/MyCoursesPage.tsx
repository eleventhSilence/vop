import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import type { EnrolledCourse, MyCoursesProgressFilter } from '@/entities/course/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

type CourseStage = {
  badge: string;
  badgeClassName: string;
  primaryLabel: string;
  primaryTo: string;
  primaryState?: { from: 'my-courses'; returnTo?: '/account/courses' };
  secondaryLabel?: string;
  secondaryTo?: string;
  secondaryState?: { from: 'my-courses'; returnTo?: '/account/courses' };
  testingUnavailableNote?: string;
};

const getCourseStage = (course: EnrolledCourse): CourseStage => {
  const learningLink = `/account/courses/${course.course_id}`;
  const testLink = `/account/courses/${course.course_id}/test`;
  const theoryIncomplete = course.progress_status === 'enrolled' || course.progress_percent <= 25 || !course.is_theory_completed;

  if (theoryIncomplete) {
    return {
      badge: 'Теория не завершена',
      badgeClassName: 'my-course-card__badge--theory-pending',
      primaryLabel: 'Продолжить теорию',
      primaryTo: learningLink,
      primaryState: { from: 'my-courses' },
      testingUnavailableNote: 'Тестирование откроется после завершения теории.',
    };
  }

  if (course.progress_status === 'theory_completed' || course.progress_percent === 50) {
    return {
      badge: 'Теория завершена',
      badgeClassName: 'my-course-card__badge--theory-completed',
      primaryLabel: 'Перейти к тестированию',
      primaryTo: testLink,
      primaryState: { from: 'my-courses', returnTo: '/account/courses' },
      secondaryLabel: 'Открыть теорию',
      secondaryTo: learningLink,
      secondaryState: { from: 'my-courses' },
    };
  }

  if (course.progress_status === 'testing_in_progress' || course.progress_percent === 75) {
    return {
      badge: 'На тестировании',
      badgeClassName: 'my-course-card__badge--testing',
      primaryLabel: 'Продолжить тестирование',
      primaryTo: testLink,
      primaryState: { from: 'my-courses', returnTo: '/account/courses' },
      secondaryLabel: 'Открыть теорию',
      secondaryTo: learningLink,
      secondaryState: { from: 'my-courses' },
    };
  }

  return {
    badge: 'Курс завершён',
    badgeClassName: 'my-course-card__badge--completed',
    primaryLabel: 'Открыть материалы',
    primaryTo: learningLink,
    primaryState: { from: 'my-courses' },
    secondaryLabel: 'Результаты тестирования',
    secondaryTo: testLink,
    secondaryState: { from: 'my-courses', returnTo: '/account/courses' },
  };
};

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
            <option value="25">Теория не завершена</option>
            <option value="50">Теория завершена</option>
            <option value="75">На тестировании</option>
            <option value="100">Завершённые</option>
          </select>
        </label>
      </div>
      {coursesQuery.isLoading ? <LoadingState message="Загружаем ваши курсы..." /> : null}
      {coursesQuery.isError ? <ErrorState message={extractApiError(coursesQuery.error)} /> : null}
      {!coursesQuery.isLoading && !coursesQuery.isError && !courses.length ? <EmptyState message={search || progress !== 'all' ? 'Курсы не найдены.' : 'У вас пока нет записанных курсов.'} /> : null}
      <div className="stack-list">
        {courses.map((course) => {
          const stage = getCourseStage(course);
          return (
            <article className="card my-course-card" key={course.course_id}>
              <div className="my-course-card__top">
                <div>
                  <h3>{course.title}</h3>
                  <p>{course.short_description}</p>
                </div>
                <div className="my-course-card__meta">
                  <strong>{course.progress_percent}%</strong>
                  <span className={`my-course-card__badge ${stage.badgeClassName}`}>{stage.badge}</span>
                </div>
              </div>
              <div className="my-course-card__progress" role="progressbar" aria-valuenow={course.progress_percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Прогресс по курсу ${course.title}`}>
                <span style={{ width: `${course.progress_percent}%` }} />
              </div>
              <div className="my-course-card__actions">
                <Link to={stage.primaryTo} state={stage.primaryState} className="button button--primary">{stage.primaryLabel}</Link>
                {stage.secondaryLabel && stage.secondaryTo ? (
                  <Link to={stage.secondaryTo} state={stage.secondaryState} className="button button--ghost">{stage.secondaryLabel}</Link>
                ) : (
                  <button type="button" className="button button--ghost" disabled>Тестирование недоступно</button>
                )}
              </div>
              {stage.testingUnavailableNote ? <p className="my-course-card__hint">{stage.testingUnavailableNote}</p> : null}
            </article>
          );
        })}
      </div>
    </PageSection>
  );
};
