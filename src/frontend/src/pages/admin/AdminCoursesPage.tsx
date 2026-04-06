import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminCourseCreatePayload, AdminCourseStatus } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { formatStatus } from '@/shared/lib/format';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import { EmptyState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { Toast } from '@/shared/ui/Toast';

type CreateCourseFormValues = {
  title: string;
  short_description: string;
  content: string;
  status: AdminCourseStatus;
};

type ValidationErrors = Partial<Record<keyof CreateCourseFormValues, string>>;

const SHORT_DESCRIPTION_MIN_LENGTH = 10;

const defaultFormValues: CreateCourseFormValues = {
  title: '',
  short_description: '',
  content: '',
  status: 'unavailable',
};

export const AdminCoursesPage = () => {
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<CreateCourseFormValues>(defaultFormValues);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isCreateFormOpen, setCreateFormOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const coursesQuery = useQuery({ queryKey: ['admin', 'courses'], queryFn: () => adminApi.courses() });
  const courses = coursesQuery.data ? ensurePaginated(coursesQuery.data).results : [];

  const createCourseMutation = useMutation({
    mutationFn: (payload: AdminCourseCreatePayload) => adminApi.createCourse(payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Курс создан.' });
      setCreateFormOpen(false);
      setFormValues(defaultFormValues);
      setValidationErrors({});
      await queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });

  const formErrorMessage = useMemo(() => {
    if (!Object.keys(validationErrors).length) {
      return null;
    }

    return 'Проверьте корректность заполнения формы.';
  }, [validationErrors]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

    const nextErrors: ValidationErrors = {};
    const title = formValues.title.trim();
    const shortDescription = formValues.short_description.trim();

    if (!title) {
      nextErrors.title = 'Введите название курса.';
    }

    if (!shortDescription) {
      nextErrors.short_description = 'Введите короткое описание курса.';
    } else if (shortDescription.length < SHORT_DESCRIPTION_MIN_LENGTH) {
      nextErrors.short_description = `Короткое описание должно быть не короче ${SHORT_DESCRIPTION_MIN_LENGTH} символов.`;
    }

    setValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    createCourseMutation.mutate({
      title,
      short_description: shortDescription,
      content: formValues.content,
      status: formValues.status,
    });
  };

  const openCreateForm = () => {
    setCreateFormOpen(true);
    setValidationErrors({});
  };

  const closeCreateForm = () => {
    setCreateFormOpen(false);
    setValidationErrors({});
    setFormValues(defaultFormValues);
  };

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (coursesQuery.isError) {
      setToast({ type: 'error', message: extractApiError(coursesQuery.error) });
    }
  }, [coursesQuery.error, coursesQuery.isError]);

  return (
    <PageSection>
      <h2>Администратор: курсы</h2>
      <div className="admin-courses-toolbar">
        <Button className="admin-courses-create-trigger" onClick={openCreateForm}>
          Создать курс
        </Button>
      </div>
      {isCreateFormOpen ? (
        <div className="overlay" role="presentation" onClick={closeCreateForm}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Создание курса</h3>
              <Button variant="ghost" type="button" onClick={closeCreateForm}>
                Закрыть
              </Button>
            </div>
            {formErrorMessage ? <p className="field__error">{formErrorMessage}</p> : null}
            <form className="stack-list" onSubmit={handleSubmit}>
              <Input
                id="admin-course-create-title"
                label="Название *"
                value={formValues.title}
                onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))}
                error={validationErrors.title}
                required
              />
              <label className="field" htmlFor="admin-course-create-short-description">
                <span className="field__label">Короткое описание *</span>
                <textarea
                  id="admin-course-create-short-description"
                  className="field__control"
                  value={formValues.short_description}
                  onChange={(event) => setFormValues((current) => ({ ...current, short_description: event.target.value }))}
                  rows={3}
                  required
                />
                {validationErrors.short_description ? <span className="field__error">{validationErrors.short_description}</span> : null}
              </label>
              <label className="field" htmlFor="admin-course-create-content">
                <span className="field__label">Контент</span>
                <textarea
                  id="admin-course-create-content"
                  className="field__control"
                  value={formValues.content}
                  onChange={(event) => setFormValues((current) => ({ ...current, content: event.target.value }))}
                  rows={8}
                />
              </label>
              <label className="field" htmlFor="admin-course-create-status">
                <span className="field__label">Статус</span>
                <select
                  id="admin-course-create-status"
                  className="field__control"
                  value={formValues.status}
                  onChange={(event) => setFormValues((current) => ({ ...current, status: event.target.value as AdminCourseStatus }))}
                >
                  <option value="unavailable">unavailable</option>
                  <option value="available">available</option>
                </select>
              </label>
              <div className="actions-row">
                <Button variant="ghost" type="button" onClick={closeCreateForm}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createCourseMutation.isPending}>
                  {createCourseMutation.isPending ? 'Создание...' : 'Создать курс'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {coursesQuery.isLoading ? <LoadingState /> : null}
      <div className="stack-list">
        {!coursesQuery.isLoading && !coursesQuery.isError && !courses.length ? (
          <EmptyState message="Курсы пока не созданы." />
        ) : null}
        {courses.map((course) => (
          <div className="card" key={course.course_id}>
            <div className="card__row">
              <h3>{course.title}</h3>
              <span>{formatStatus(course.status)}</span>
            </div>
            <p>{course.short_description}</p>
            <p className="muted">{course.content || 'Контент пока пуст.'}</p>
            <Link to={`/admin/courses/${course.course_id}`} className="text-link">
              Открыть карточку курса →
            </Link>
          </div>
        ))}
      </div>
      {toast ? <Toast key={toast.message} type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
