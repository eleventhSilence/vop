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

export const formatStatus = (status: string) => {
  if (status === 'ACTIVE') return 'Активен';
  if (status === 'BLOCKED') return 'Заблокирован';
  if (status === 'AVAILABLE') return 'Доступен';
  if (status === 'UNAVAILABLE') return 'Скрыт';
  if (status === 'PENDING') return 'На модерации';
  if (status === 'APPROVED') return 'Одобрен';
  if (status === 'REJECTED') return 'Отклонён';
  if (status === 'NOT_STARTED') return 'Не начат';
  if (status === 'IN_PROGRESS') return 'В процессе';
  if (status === 'COMPLETED') return 'Завершён';
  return status;
};
