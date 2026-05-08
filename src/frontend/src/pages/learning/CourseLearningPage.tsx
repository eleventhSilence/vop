import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
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
  const headings = useMemo(() => extractCourseHeadings(courseQuery.data?.content ?? ''), [courseQuery.data?.content]);

  useEffect(() => {
    if (myCourseReview) {
      setReviewDraft({ comment: myCourseReview.comment, rating: myCourseReview.rating });
      return;
    }
    setReviewDraft({ comment: '', rating: 5 });
  }, [myCourseReview]);

  useEffect(() => {
    setActiveHeadingId(headings[0]?.id ?? null);
    if (!headings.length) return;
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target.id) {
        setActiveHeadingId(visible.target.id);
        return;
      }
      const passed = elements
        .filter((element) => element.getBoundingClientRect().top <= 140)
        .at(-1);
      if (passed?.id) setActiveHeadingId(passed.id);
    }, { rootMargin: '-120px 0px -55% 0px', threshold: [0, 0.2, 0.5] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

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
  const getProgressStage = () => {
    if (!progressQuery.data) return '';
    if (progressQuery.data.progress_status === 'completed' || progressQuery.data.progress_percent >= 100) return 'Курс завершён';
    if (progressQuery.data.progress_percent >= 75) return 'Предприняты попытки прохождения теста, тест пока не завершён';
    if (progressQuery.data.is_theory_completed || progressQuery.data.progress_percent >= 50) return 'Теория завершена';
    if (progressQuery.data.progress_percent > 0) return 'Теория не завершена';
    return 'Записан на курс';
  };

  return (
    <PageSection>
      {(courseQuery.isLoading || progressQuery.isLoading) ? <LoadingState message="Загружаем учебные материалы..." /> : null}
      {pageError ? <ErrorState message={extractApiError(pageError)} /> : null}
      {courseQuery.data && progressQuery.data ? (
        <div className="learning-layout">
          <article className="card card--wide form-stack course-main-column">
            <h2>{courseQuery.data.title}</h2>

            <div className="learning-progress-card">
              <div className="card__row">
                <h3>Прогресс</h3>
                <strong>{progressQuery.data.progress_percent}%</strong>
              </div>
              <div className="learning-progress-card__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressQuery.data.progress_percent}>
                <span style={{ width: `${progressQuery.data.progress_percent}%` }} />
              </div>
              <p className="muted">{getProgressStage()}</p>
            </div>

            <CourseContentRenderer content={courseQuery.data.content} media={courseQuery.data.media} />

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
          <aside className="course-toc card">
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
