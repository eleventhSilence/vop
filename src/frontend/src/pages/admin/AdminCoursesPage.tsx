import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminCourseCreatePayload, AdminCourseStatus } from '@/entities/admin/types';
import { COURSE_STATUS_OPTIONS } from '@/entities/course/status';
import { extractApiError } from '@/shared/api/client';
import { formatDateTime } from '@/shared/lib/format';
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
const getPageFromUrl = (url: string | null) => {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url, 'http://localhost');
    const page = parsedUrl.searchParams.get('page');
    return page ? Number(page) : null;
  } catch {
    return null;
  }
};

const defaultFormValues: CreateCourseFormValues = {
  title: '',
  short_description: '',
  content: '',
  status: 'unavailable',
};

const MarkdownHelp = () => (
  <details className="markdown-help">
    <summary className="markdown-help__summary">Подсказка по оформлению</summary>
    <div className="markdown-help__content">
      <p className="muted">Сначала загрузите файл в блоке «Файлы курса», затем используйте его <code>slug</code> в поле контента. HTML-теги запрещены и не обрабатываются.</p>
      <div className="markdown-help__section">
        <h4>Заголовки</h4>
        <pre className="markdown-help__code">{`# Заголовок 1 уровня
## Заголовок 2 уровня
### Заголовок 3 уровня`}</pre>
        <p className="muted"># и ## попадают в содержание курса. ### используется как внутренний подзаголовок и в содержание не попадает.</p>
      </div>
      <div className="markdown-help__section">
        <h4>Выделение текста</h4>
        <pre className="markdown-help__code">{`**жирный текст**
*курсивный текст*
***жирный курсив***
~~зачёркнутый текст~~`}</pre>
      </div>
      <div className="markdown-help__section">
        <h4>Списки и чек-листы</h4>
        <pre className="markdown-help__code">{`- пункт списка
- пункт списка

1. первый пункт
2. второй пункт

- [ ] невыполненный пункт
- [x] выполненный пункт`}</pre>
      </div>
      <div className="markdown-help__section">
        <h4>Цитата, разделитель, таблица</h4>
        <pre className="markdown-help__code">{`> Важная информация

---

| Раздел | Описание         |
| ------ | ---------------- |
| Теория | Учебный материал |
| Тест   | Проверка знаний  |`}</pre>
      </div>
      <div className="markdown-help__section">
        <h4>Ссылки и материалы курса</h4>
        <pre className="markdown-help__code">{`[Текст ссылки](https://example.com)
![Описание изображения](media\:slug)
[Описание материала](media:slug)
{{ media:slug }}`}</pre>
      </div>
    </div>
  </details>
);

export const AdminCoursesPage = () => {
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<CreateCourseFormValues>(defaultFormValues);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isCreateFormOpen, setCreateFormOpen] = useState(false);
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [editFormValues, setEditFormValues] = useState<CreateCourseFormValues>(defaultFormValues);
  const [editValidationErrors, setEditValidationErrors] = useState<ValidationErrors>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminCourseStatus>('all');
  const [page, setPage] = useState(1);
  const [knownPageSize, setKnownPageSize] = useState<number | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', page, search, statusFilter],
    queryFn: () => adminApi.courses({ page, search: search || undefined, status: statusFilter }),
  });
  const paginatedCourses = coursesQuery.data ? ensurePaginated(coursesQuery.data) : { count: 0, next: null, previous: null, results: [] };
  const courses = paginatedCourses.results;
  const hasNextPage = Boolean(paginatedCourses.next);
  const hasPreviousPage = Boolean(paginatedCourses.previous);
  const nextPage = getPageFromUrl(paginatedCourses.next) ?? (hasNextPage ? page + 1 : null);
  const previousPage = getPageFromUrl(paginatedCourses.previous) ?? (hasPreviousPage ? Math.max(1, page - 1) : null);
  const pageSize = knownPageSize ?? (courses.length || 1);
  const totalPages = Math.max(1, Math.ceil(paginatedCourses.count / pageSize));

  useEffect(() => {
    if (courses.length && (!knownPageSize || courses.length > knownPageSize)) {
      setKnownPageSize(courses.length);
    }
  }, [courses.length, knownPageSize]);

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
    mutationFn: ({ file }: { file: File }) => adminApi.uploadCourseMedia(editCourseId as string, { file }),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Файл загружен.' });
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
  const mediaFiles = Array.isArray(mediaQuery.data) ? mediaQuery.data : [];
  const mediaDisplayTitle = (item: CourseMedia) => {
    if (item.title?.trim()) return item.title.trim();
    if (item.original_name?.trim()) return item.original_name.replace(/\.[^.]+$/, '').trim();
    return item.slug;
  };
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

  const handleCourseRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, courseId: string) => {
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
      <div className="section-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h2>Администрирование курсов</h2>
          <p className="muted">Управляйте списком курсов, статусами и содержанием без изменения текущей логики API.</p>
        </div>
      </div>
      <div className="admin-page-controls admin-courses-toolbar">
        <div className="card admin-list-filters admin-list-filters--panel">
          <Input id="admin-courses-search" label="Поиск" placeholder="Поиск по курсам" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <label className="field" htmlFor="admin-courses-status-filter">
            <span className="field__label">Статус</span>
            <select id="admin-courses-status-filter" className="field__control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | AdminCourseStatus)}>
              <option value="all">Все статусы</option>
              {COURSE_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
              ))}
            </select>
          </label>
        </div>
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
                <MarkdownHelp />
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
                  {COURSE_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
                  ))}
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
                <MarkdownHelp />
              </label>
              {editCourseId ? (
                <section className="card stack-list">
                  <h4>Файлы курса</h4>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!editCourseId || !file) {
                        e.currentTarget.value = '';
                        return;
                      }
                      uploadMediaMutation.mutate({ file });
                      e.currentTarget.value = '';
                    }}
                  />
                  {mediaFiles.map((item: CourseMedia) => (
                    <div key={item.id} className="list-item">
                      <div><strong>{item.title}</strong> ({item.media_type}) — {item.original_name} — {item.slug}</div>
                      <div className="actions-row">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            const title = mediaDisplayTitle(item);
                            const snippet = item.media_type === 'image'
                              ? `![${title}](media:${item.slug})`
                              : `[${title}](media:${item.slug})`;
                            navigator.clipboard.writeText(snippet);
                          }}
                        >
                          Скопировать вставку
                        </Button>
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
                  {COURSE_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
                  ))}
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
      <div className="table-card admin-courses-table-panel">
        <div className="table-card__header">
          <div>
            <strong>Всего курсов: {paginatedCourses.count}</strong>
            <p className="muted">Страница {page} из {totalPages}. Сейчас показано {courses.length} записей.</p>
          </div>
          <div className="pagination-controls" aria-label="Пагинация курсов">
            <Button variant="ghost" onClick={() => previousPage !== null && setPage(previousPage)} disabled={!hasPreviousPage || coursesQuery.isLoading}>Назад</Button>
            <span className="pagination-controls__status">Страница {page}</span>
            <Button variant="ghost" onClick={() => nextPage !== null && setPage(nextPage)} disabled={!hasNextPage || coursesQuery.isLoading}>Вперёд</Button>
          </div>
        </div>
        {!coursesQuery.isLoading && !coursesQuery.isError && !courses.length ? (
          <EmptyState message={search || statusFilter !== 'all' ? 'Курсы не найдены.' : 'Курсы пока не созданы.'} />
        ) : null}
        {courses.length ? (
          <div className="admin-courses-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Статус</th>
                  <th>Дата создания</th>
                  <th>Дата обновления</th>
                  <th>Участники</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr
                    key={course.course_id}
                    className="users-table__row"
                    onClick={() => openEditForm(course.course_id)}
                    onKeyDown={(event) => handleCourseRowKeyDown(event, course.course_id)}
                    tabIndex={0}
                    role="button"
                    title={`Открыть карточку курса «${course.title}»`}
                  >
                    <td className="admin-courses-table__title"><strong>{course.title}</strong></td>
                    <td><StatusBadge status={course.status} tone={course.status === 'available' ? 'success' : 'danger'} /></td>
                    <td>{formatDateTime(course.created_at)}</td>
                    <td>{course.updated_at ? formatDateTime(course.updated_at) : '—'}</td>
                    <td>
                      <Link
                        to={`/admin/courses/${course.course_id}/participants`}
                        className="admin-test-card__questions-chip"
                        onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
                      >
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {toast ? <Toast key={toast.message} type={toast.type} message={toast.message} /> : null}
    </PageSection>
  );
};
