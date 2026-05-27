import { COURSE_STATUS_LABELS } from '@/entities/course/status';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Активен',
  BLOCKED: 'Заблокирован',
  ...COURSE_STATUS_LABELS,
  pending: 'На модерации',
  approved: 'Одобрен',
  rejected: 'Отклонён',
  not_enrolled: 'Не записан',
  enrolled: 'Записан',
  theory_completed: 'Теория завершена',
  testing_in_progress: 'Тестирование начато',
  completed: 'Завершён',
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const formatRole = (role: string) => {
  if (role === 'ADMIN') return 'Администратор';
  if (role === 'USER') return 'Пользователь';
  return role;
};

export const formatStatus = (status: string) => statusLabels[status] ?? status;
