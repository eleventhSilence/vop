import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/entities/admin/api';
import type { AdminCourseCreatePayload, AdminCourseStatus } from '@/entities/admin/types';
import { extractApiError } from '@/shared/api/client';
import { ensurePaginated } from '@/shared/lib/pagination';
import { Button } from '@/shared/ui/Button';
import type { CourseMedia } from '@/entities/course/types';
import { EmptyState, LoadingState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';
import { StatusBadge } from '@/shared/ui/StatusBadge';
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
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [editFormValues, setEditFormValues] = useState<CreateCourseFormValues>(defaultFormValues);
  const [editValidationErrors, setEditValidationErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');

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

  const updateCourseMutation = useMutation({
    mutationFn: ({ courseId, payload }: { courseId: string; payload: AdminCourseCreatePayload }) => adminApi.updateCourse(courseId, payload),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Курс обновлён.' });
      setEditCourseId(null);
      setEditFormValues(defaultFormValues);
      setEditValidationErrors({});
      await queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (error) => {
      setToast({ type: 'error', message: extractApiError(error) });
    },
  });


  const mediaQuery = useQuery({
    queryKey: ['admin', 'course-media', editCourseId],
    queryFn: () => adminApi.courseMedia(editCourseId as string),
    enabled: Boolean(editCourseId),
  });

  const uploadMediaMutation = useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) => adminApi.uploadCourseMedia(editCourseId as string, { file, title }),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Файл загружен.' });
      setMediaTitle('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'course-media', editCourseId] });
    },
    onError: (error) => setToast({ type: 'error', message: extractApiError(error) }),
  });

  const deleteMediaMutation = useMutation({
    mutationFn: (mediaId: string) => adminApi.deleteCourseMedia(editCourseId as string, mediaId),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Файл удалён.' });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'course-media', editCourseId] });
    },
    onError: (error) => setToast({ type: 'error', message: extractApiError(error) }),
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

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

    if (!editCourseId) {
      return;
    }

    const nextErrors: ValidationErrors = {};
    const title = editFormValues.title.trim();
    const shortDescription = editFormValues.short_description.trim();

    if (!title) {
      nextErrors.title = 'Введите название курса.';
    }

    if (!shortDescription) {
      nextErrors.short_description = 'Введите короткое описание курса.';
    } else if (shortDescription.length < SHORT_DESCRIPTION_MIN_LENGTH) {
      nextErrors.short_description = `Короткое описание должно быть не короче ${SHORT_DESCRIPTION_MIN_LENGTH} символов.`;
    }

    setEditValidationErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setToast({ type: 'error', message: 'Проверьте корректность заполнения формы.' });
      return;
    }

    updateCourseMutation.mutate({
      courseId: editCourseId,
      payload: {
        title,
        short_description: shortDescription,
        content: editFormValues.content,
        status: editFormValues.status,
      },
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

  const openEditForm = (courseId: string) => {
    const course = courses.find((item) => item.course_id === courseId);

    if (!course) {
      return;
    }

    setEditCourseId(course.course_id);
    setEditValidationErrors({});
    setEditFormValues({
      title: course.title,
      short_description: course.short_description,
      content: course.content,
      status: course.status,
    });
  };

  const closeEditForm = () => {
    setEditCourseId(null);
    setEditValidationErrors({});
    setEditFormValues(defaultFormValues);
  };

  const handleCourseCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, courseId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openEditForm(courseId);
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
              <p className="muted">Файлы курса можно будет добавить после создания курса в режиме редактирования.</p>
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
      {editCourseId ? (
        <div className="overlay" role="presentation" onClick={closeEditForm}>
          <div className="overlay__panel card stack-list" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="card__row">
              <h3>Редактирование курса</h3>
              <Button variant="ghost" type="button" onClick={closeEditForm}>
                Закрыть
              </Button>
            </div>
            {Object.keys(editValidationErrors).length ? <p className="field__error">Проверьте корректность заполнения формы.</p> : null}
            <form className="stack-list" onSubmit={handleEditSubmit}>
              <Input
                id="admin-course-edit-title"
                label="Название *"
                value={editFormValues.title}
                onChange={(event) => setEditFormValues((current) => ({ ...current, title: event.target.value }))}
                error={editValidationErrors.title}
                required
              />
              <label className="field" htmlFor="admin-course-edit-short-description">
                <span className="field__label">Короткое описание *</span>
                <textarea
                  id="admin-course-edit-short-description"
                  className="field__control"
                  value={editFormValues.short_description}
                  onChange={(event) => setEditFormValues((current) => ({ ...current, short_description: event.target.value }))}
                  rows={3}
                  required
                />
                {editValidationErrors.short_description ? <span className="field__error">{editValidationErrors.short_description}</span> : null}
              </label>
              <label className="field" htmlFor="admin-course-edit-content">
                <span className="field__label">Контент</span>
                <textarea
                  id="admin-course-edit-content"
                  className="field__control"
                  value={editFormValues.content}
                  onChange={(event) => setEditFormValues((current) => ({ ...current, content: event.target.value }))}
                  rows={8}
                />
              </label>

              <p className="muted">Markdown поддерживает заголовки, списки, ссылки. HTML запрещён. Изображение: <code>{'![Описание](media:slug)'}</code>. Видео/документ: <code>{'{{ media:slug }}'}</code>. Сначала загрузите файл в блоке «Файлы курса».</p>
              {editCourseId ? (
                <section className="card stack-list">
                  <h4>Файлы курса</h4>
                  <Input id="media-title" label="Название файла (опционально)" value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} />
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!editCourseId || !file) {
                        e.currentTarget.value = '';
                        return;
                      }
                      uploadMediaMutation.mutate({ file, title: mediaTitle || undefined });
                      e.currentTarget.value = '';
                    }}
                  />
                  {mediaQuery.data?.map((item: CourseMedia) => (
                    <div key={item.id} className="list-item">
                      <div><strong>{item.title}</strong> ({item.media_type}) — {item.original_name} — {item.slug}</div>
                      <div className="actions-row">
                        <Button type="button" variant="ghost" onClick={() => navigator.clipboard.writeText(item.markdown_image_snippet ?? item.markdown_embed_snippet)}>Скопировать вставку</Button>
                        <Button type="button" variant="ghost" onClick={() => window.confirm('Удалить файл?') && deleteMediaMutation.mutate(item.id)}>Удалить</Button>
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}
              <label className="field" htmlFor="admin-course-edit-status">
                <span className="field__label">Статус</span>
                <select
                  id="admin-course-edit-status"
                  className="field__control"
                  value={editFormValues.status}
                  onChange={(event) => setEditFormValues((current) => ({ ...current, status: event.target.value as AdminCourseStatus }))}
                >
                  <option value="unavailable">unavailable</option>
                  <option value="available">available</option>
                </select>
              </label>
              <div className="actions-row">
                <Button variant="ghost" type="button" onClick={closeEditForm}>
                  Отмена
                </Button>
                <Button type="submit" disabled={updateCourseMutation.isPending}>
                  {updateCourseMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {coursesQuery.isLoading ? <LoadingState /> : null}
      <div className="stack-list admin-courses-list">
        {!coursesQuery.isLoading && !coursesQuery.isError && !courses.length ? (
          <EmptyState message="Курсы пока не созданы." />
        ) : null}
        {courses.map((course) => (
          <div
            className={`card admin-course-card admin-course-card--${course.status} admin-interactive-card`}
            key={course.course_id}
            role="button"
            tabIndex={0}
            aria-label={`Открыть карточку курса «${course.title}»`}
            onClick={() => openEditForm(course.course_id)}
            onKeyDown={(event) => handleCourseCardKeyDown(event, course.course_id)}
          >
            <div className="card__row admin-course-card__header">
              <h3 className="admin-course-card__title">{course.title}</h3>
              <StatusBadge
                status={course.status}
                tone={course.status === 'available' ? 'success' : 'danger'}
              />
            </div>
            <p className="admin-course-card__description">{course.short_description}</p>
          </div>
        ))}
      </div>
      {toast ? <Toast key={toast.message} type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
