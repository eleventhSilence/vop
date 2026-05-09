import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import { coursesApi } from '@/entities/course/api';
import { CourseContentRenderer, extractCourseHeadings } from '@/entities/course/CourseContentRenderer';
import { progressApi } from '@/entities/progress/api';
import { reviewsApi } from '@/entities/review/api';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { PageSection } from '@/shared/ui/PageSection';

export const CourseLearningPage = () => {
  const { courseId = '' } = useParams();

  const location = useLocation();
  const fromSource = (location.state as { from?: string } | null)?.from;
  const isFromCourseDetail = fromSource === 'course-detail';
  const backTarget = isFromCourseDetail ? `/courses/${courseId}` : '/account/courses';
  const backLabel = isFromCourseDetail ? '← К курсу' : '← Мои курсы';
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
  const myReviewsQuery = useQuery({
    queryKey: ['reviews', 'my'],
    queryFn: reviewsApi.myReviews,
    enabled: Boolean(courseId),
  });

  const myCourseReview = useMemo(() => {
    if (!myReviewsQuery.data) return undefined;
    return ensurePaginated(myReviewsQuery.data).results.find((review) => review.course_id === courseId);
  }, [courseId, myReviewsQuery.data]);

  const [reviewDraft, setReviewDraft] = useState({ comment: '', rating: 5 });
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [visualProgressPercent, setVisualProgressPercent] = useState<number | null>(null);
  const courseContentRef = useRef<HTMLDivElement | null>(null);
  const courseContent = courseQuery.data?.content ?? '';
  const headings = useMemo(() => extractCourseHeadings(courseContent), [courseContent]);

  useEffect(() => {
    if (myCourseReview) {
      setReviewDraft({ comment: myCourseReview.comment, rating: myCourseReview.rating });
      return;
    }
    setReviewDraft({ comment: '', rating: 5 });
  }, [myCourseReview]);

  const getHeaderOffset = useCallback(() => {
    const topBar = document.querySelector('.topbar');
    const headerHeight = topBar instanceof HTMLElement ? topBar.offsetHeight : 112;
    return headerHeight + 40;
  }, []);

  const updateActiveHeading = useCallback(() => {
    if (!headings.length) {
      setActiveHeadingId(null);
      return;
    }

    const headingElements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!headingElements.length) return;

    const offset = getHeaderOffset();
    let currentId = headingElements[0].id;

    for (const element of headingElements) {
      if (element.getBoundingClientRect().top <= offset) {
        currentId = element.id;
      } else {
        break;
      }
    }

    setActiveHeadingId((previous) => (previous === currentId ? previous : currentId));
  }, [getHeaderOffset, headings]);

  useEffect(() => {
    if (courseQuery.isLoading || !courseContent || !headings.length) {
      setActiveHeadingId(headings[0]?.id ?? null);
      return;
    }

    let raf1 = 0;
    let raf2 = 0;
    let timeoutId: number | null = null;
    let scrollRafId: number | null = null;

    const scheduleUpdate = () => {
      if (scrollRafId !== null) return;
      scrollRafId = window.requestAnimationFrame(() => {
        scrollRafId = null;
        updateActiveHeading();
      });
    };

    raf1 = window.requestAnimationFrame(() => {
      updateActiveHeading();
      raf2 = window.requestAnimationFrame(updateActiveHeading);
    });
    timeoutId = window.setTimeout(updateActiveHeading, 0);

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      if (scrollRafId !== null) window.cancelAnimationFrame(scrollRafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [courseContent, courseId, courseQuery.isLoading, headings, updateActiveHeading]);

  useEffect(() => {
    const progress = progressQuery.data;
    if (!progress || progress.is_theory_completed || progress.progress_percent >= 50) {
      setVisualProgressPercent(null);
      return;
    }

    const baseProgress = 25;
    const targetProgress = 50;
    let animationFrameId: number | null = null;

    const updateVisualProgress = () => {
      const contentElement = courseContentRef.current;
      if (!contentElement) return;

      const rect = contentElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const maxTravel = rect.height + viewportHeight;

      if (maxTravel <= 0) {
        setVisualProgressPercent(baseProgress);
        return;
      }

      const travelled = viewportHeight - rect.top;
      const scrollRatio = Math.min(1, Math.max(0, travelled / maxTravel));
      const nextProgress = Math.round(baseProgress + scrollRatio * (targetProgress - baseProgress));
      setVisualProgressPercent(Math.min(targetProgress, Math.max(baseProgress, nextProgress)));
    };

    const scheduleUpdate = () => {
      if (animationFrameId !== null) return;
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        updateVisualProgress();
      });
    };

    updateVisualProgress();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [progressQuery.data]);

  const completeTheoryMutation = useMutation({
    mutationFn: () => progressApi.completeTheory(courseId),
    onSuccess: async () => {
      await progressQuery.refetch();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!courseId) throw new Error('Не удалось определить курс для отзыва.');
      if (myCourseReview) return reviewsApi.update(myCourseReview.review_id, reviewDraft);
      return reviewsApi.create({ course_id: courseId, comment: reviewDraft.comment, rating: reviewDraft.rating });
    },
    onSuccess: async (updatedReview) => {
      setReviewDraft({ comment: updatedReview.comment, rating: updatedReview.rating });
      await myReviewsQuery.refetch();
    },
  });

  const handleReviewSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (reviewDraft.rating < 1 || reviewDraft.rating > 5) {
      setReviewError('Выберите оценку от 1 до 5 звёзд.');
      return;
    }
    setReviewError(null);
    reviewMutation.mutate();
  };

  const pageError = courseQuery.isError ? courseQuery.error : progressQuery.isError ? progressQuery.error : null;
  const displayProgressPercent = useMemo(() => {
    if (!progressQuery.data) return 0;
    if (progressQuery.data.is_theory_completed || progressQuery.data.progress_percent >= 50) return progressQuery.data.progress_percent;
    return visualProgressPercent ?? Math.max(25, progressQuery.data.progress_percent);
  }, [progressQuery.data, visualProgressPercent]);

  const getProgressStage = () => {
    if (!progressQuery.data) return '';
    if (progressQuery.data.progress_status === 'completed' || progressQuery.data.progress_percent >= 100) return 'Курс завершён';
    if (progressQuery.data.progress_percent >= 75) return 'Тестирование начато';
    if (progressQuery.data.is_theory_completed || progressQuery.data.progress_percent >= 50) return 'Теория завершена';
    return 'Теория не завершена';
  };

  return (
    <PageSection className="learning-page-stack">
      <Link to={backTarget} className="button button--ghost public-course-details-back-link">
        {backLabel}
      </Link>
      {(courseQuery.isLoading || progressQuery.isLoading) ? <LoadingState message="Загружаем учебные материалы..." /> : null}
      {pageError ? <ErrorState message={extractApiError(pageError)} /> : null}
      {courseQuery.data && progressQuery.data ? (
        <div className="learning-layout">
          <article className="card card--wide form-stack">
            <h2>{courseQuery.data.title}</h2>

            <div ref={courseContentRef} className="learning-course-content">
              <CourseContentRenderer content={courseQuery.data.content} media={courseQuery.data.media} />
            </div>

            {!progressQuery.data.is_theory_completed ? (
              <Button onClick={() => completeTheoryMutation.mutate()} disabled={completeTheoryMutation.isPending}>Завершить теорию</Button>
            ) : null}
            {completeTheoryMutation.isError ? <ErrorState message={extractApiError(completeTheoryMutation.error)} /> : null}
            {completeTheoryMutation.isSuccess ? <SuccessState message="Теория отмечена как завершённая. Прогресс курса обновлён." /> : null}

            {progressQuery.data.is_theory_completed ? (
              <div className="form-stack">
                <p className="muted">Тестирование доступно.</p>
                <Link to={`/account/courses/${courseId}/test`} className="button button--secondary">Перейти к тестированию</Link>
              </div>
            ) : null}
          </article>
          <aside className="course-side-panel">
            <div className="learning-progress-card card">
              <div className="card__row">
                <h3>Прогресс</h3>
                <strong>{displayProgressPercent}%</strong>
              </div>
              <div className="learning-progress-card__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayProgressPercent}>
                <span style={{ width: `${displayProgressPercent}%` }} />
              </div>
              <p className="muted">{getProgressStage()}</p>
            </div>

            <div className="course-toc card">
              <h3>Содержание</h3>
              {headings.length ? (
                <nav className="course-toc__nav" aria-label="Содержание курса">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      onClick={() => setActiveHeadingId(heading.id)}
                      className={`course-toc__link course-toc__link--h${heading.level} ${activeHeadingId === heading.id ? 'course-toc__link--active' : ''}`}
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
              ) : (
                <p className="course-toc__empty muted">Содержание отсутствует</p>
              )}
            </div>
          </aside>

          <section className="card form-stack">
            <div>
              <h3>{myCourseReview ? 'Ваш отзыв по курсу' : 'Оставить отзыв по курсу'}</h3>
              <p className="muted">Напишите отзыв сразу после прохождения теории или завершения курса.</p>
            </div>

            {myReviewsQuery.isLoading ? <LoadingState message="Загружаем ваш отзыв..." /> : null}
            {myReviewsQuery.isError ? <ErrorState message={extractApiError(myReviewsQuery.error)} /> : null}

            {!myReviewsQuery.isLoading && !myReviewsQuery.isError ? (
              <form className="form-stack" onSubmit={handleReviewSubmit}>
                <label className="field">
                  <span className="field__label">Комментарий</span>
                  <textarea
                    id="course-review-comment"
                    className="field__control"
                    value={reviewDraft.comment}
                    onChange={(event) => setReviewDraft((current) => ({ ...current, comment: event.target.value }))}
                    required
                    disabled={reviewMutation.isPending}
                  />
                </label>

                <div className="field">
                  <span className="field__label">Оценка</span>
                  <div className="star-rating" role="group" aria-label="Выбор рейтинга">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`star-rating__star ${value <= reviewDraft.rating ? 'star-rating__star--active' : ''}`}
                        aria-label={`Оценка ${value}`}
                        title={`Оценка ${value}`}
                        onClick={() => setReviewDraft((current) => ({ ...current, rating: value }))}
                        disabled={reviewMutation.isPending}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" disabled={reviewMutation.isPending} fullWidth>
                  {myCourseReview ? 'Обновить отзыв' : 'Оставить отзыв'}
                </Button>
                {reviewError ? <ErrorState message={reviewError} /> : null}
                {reviewMutation.isError ? <ErrorState message={extractApiError(reviewMutation.error)} /> : null}
                {reviewMutation.isSuccess ? <SuccessState message="Отзыв сохранён. После модерации он появится на публичной странице курса." /> : null}
                {!myCourseReview ? <EmptyState message="Вы ещё не оставляли отзыв по этому курсу." /> : null}
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
    </PageSection>
  );
};
