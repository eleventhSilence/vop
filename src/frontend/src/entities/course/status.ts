import type { CourseStatus } from '@/entities/course/types';

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  available: 'Доступен',
  unavailable: 'Скрыт',
};

export const COURSE_STATUS_OPTIONS: Array<{ value: CourseStatus; label: string }> = [
  { value: 'available', label: COURSE_STATUS_LABELS.available },
  { value: 'unavailable', label: COURSE_STATUS_LABELS.unavailable },
];

export const getCourseStatusLabel = (status: CourseStatus) => COURSE_STATUS_LABELS[status];
