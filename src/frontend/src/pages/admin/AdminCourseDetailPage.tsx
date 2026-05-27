import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '@/entities/admin/api';
import type { AdminCourseStatus, AdminCourseUpdatePayload } from '@/entities/admin/types';
import { COURSE_STATUS_OPTIONS } from '@/entities/course/status';
import { extractApiError } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '@/shared/ui/DataState';
import { Input } from '@/shared/ui/Input';
import { PageSection } from '@/shared/ui/PageSection';

type CourseFormValues = {
  title: string;
  short_description: string;
  content: string;
  status: AdminCourseStatus;
};

type ValidationErrors = Partial<Record<keyof CourseFormValues, string>>;

const SHORT_DESCRIPTION_MIN_LENGTH = 10;


const MarkdownHelp = () => (
  <details className="markdown-help">
    <summary className="markdown-help__summary">Подсказка по оформлению</summary>
    <div className="markdown-help__content">
      <p className="muted">Сначала загрузите файл в блоке «Файлы курса», затем используйте его <code>slug</code> в поле контента. HTML-теги запрещены и не обрабатываются.</p>
      <pre className="markdown-help__code">{`# Заголовок
## Раздел
### Подраздел

**жирный** *курсив* ***жирный курсив*** ~~зачёркнутый~~

- [ ] задача
- [x] выполнено

| Раздел | Описание |
| --- | --- |
| Теория | Материал |

![Описание изображения](media\:slug)
[Описание материала](media:slug)
{{ media:slug }}`}</pre>
    </div>
  </details>
);

export const AdminCourseDetailPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [formValues, setFormValues] = useState<CourseFormValues>({
    title: '',
    short_description: '',
    content: '',
    status: 'unavailable',
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ['admin', 'course-detail', courseId],
    queryFn: () => adminApi.courseDetail(courseId!),
    enabled: Boolean(courseId),
  });

  useEffect(() => {
    if (!courseQuery.data) {
      return;
    }

    setFormValues({
      title: courseQuery.data.title,
      short_description: courseQuery.data.short_description,
      content: courseQuery.data.content,
      status: courseQuery.data.status,
    });
    setValidationErrors({});
  }, [courseQuery.data]);

  const updateCourseMutation = useMutation({
    mutationFn: (payload: AdminCourseUpdatePayload) => adminApi.updateCourse(courseId!, payload),
    onSuccess: async () => {
      setSuccessMessage('Курс успешно сохранён.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'course-detail', courseId], exact: true }),
      ]);
    },
  });

  const changeAvailabilityMutation = useMutation({
    mutationFn: (status: AdminCourseStatus) => adminApi.updateCourse(courseId!, { status }),
    onSuccess: async () => {
      setSuccessMessage('Статус курса успешно обновлён.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'course-detail', courseId], exact: true });
    },
  });

  const formErrorMessage = useMemo(() => {
    if (!Object.keys(validationErrors).length) {
      return null;
    }

    return 'Проверьте корректность заполнения формы.';
  }, [validationErrors]);

  const mutationsArePending = updateCourseMutation.isPending || changeAvailabilityMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

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
      return;
    }

    updateCourseMutation.mutate({
      title,
      short_description: shortDescription,
      content: formValues.content,
      status: formValues.status,
    });
  };

  const handleToggleAvailability = () => {
    setSuccessMessage(null);
    const targetStatus: AdminCourseStatus = formValues.status === 'available' ? 'unavailable' : 'available';
    const confirmMessage =
      targetStatus === 'unavailable'
        ? 'Скрыть курс из общего доступа?'
        : 'Сделать курс доступным для общего доступа?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    changeAvailabilityMutation.mutate(targetStatus);
  };

  if (!courseId) {
    return (
      <PageSection>
        <ErrorState message="Не удалось определить ID курса в маршруте." />
      </PageSection>
    );
  }

  return (
    <PageSection>
      <div className="card">
        <p className="eyebrow">Администрирование</p>
        <h2>Карточка курса</h2>
        <p className="muted">ID курса: {courseId}</p>
        <p>
          <Link className="text-link" to="/admin/courses">
            ← К списку курсов
          </Link>
        </p>
      </div>
      {courseQuery.isLoading ? <LoadingState /> : null}
      {courseQuery.isError ? <ErrorState message={extractApiError(courseQuery.error)} /> : null}
      {courseQuery.isSuccess && !courseQuery.data ? <EmptyState message="Курс не найден." /> : null}
      {formErrorMessage ? <ErrorState message={formErrorMessage} /> : null}
      {updateCourseMutation.isError ? <ErrorState message={extractApiError(updateCourseMutation.error)} /> : null}
      {changeAvailabilityMutation.isError ? <ErrorState message={extractApiError(changeAvailabilityMutation.error)} /> : null}
      {successMessage ? <SuccessState message={successMessage} /> : null}
      {courseQuery.isSuccess && courseQuery.data ? (
        <form className="card stack-list" onSubmit={handleSubmit}>
          <Input
            id="admin-course-title"
            label="Название"
            value={formValues.title}
            onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))}
            error={validationErrors.title}
            required
          />
          <label className="field" htmlFor="admin-course-short-description">
            <span className="field__label">Короткое описание</span>
            <textarea
              id="admin-course-short-description"
              className="field__control"
              value={formValues.short_description}
              onChange={(event) => setFormValues((current) => ({ ...current, short_description: event.target.value }))}
              rows={3}
              required
            />
            {validationErrors.short_description ? <span className="field__error">{validationErrors.short_description}</span> : null}
          </label>
          <label className="field" htmlFor="admin-course-content">
            <span className="field__label">Контент</span>
            <textarea
              id="admin-course-content"
              className="field__control"
              value={formValues.content}
              onChange={(event) => setFormValues((current) => ({ ...current, content: event.target.value }))}
              rows={12}
            />
          </label>
          <MarkdownHelp />
          <label className="field" htmlFor="admin-course-status">
            <span className="field__label">Статус</span>
            <select
              id="admin-course-status"
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
            <Button type="submit" disabled={mutationsArePending}>
              {updateCourseMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/courses')} disabled={mutationsArePending}>
              Назад к курсам
            </Button>
            <Button type="button" variant="ghost" onClick={handleToggleAvailability} disabled={mutationsArePending}>
              {changeAvailabilityMutation.isPending
                ? formValues.status === 'available'
                  ? 'Скрытие...'
                  : 'Публикация...'
                : formValues.status === 'available'
                  ? 'Скрыть курс'
                  : 'Сделать курс доступным'}
            </Button>
          </div>
        </form>
      ) : null}
    </PageSection>
  );
};
