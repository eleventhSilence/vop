import type { AdminCourse, Course, CourseDetail, CourseEnrollment, EnrolledCourse } from '@/entities/course/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';
import { http } from '@/shared/api/http';

export const coursesApi = {
  list(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<Course>>('/courses/', { params }).then((response) => response.data);
  },
  detail(courseId: string) {
    return http.get<CourseDetail>(`/courses/${courseId}/`).then((response) => response.data);
  },
  enroll(courseId: string) {
    return http.post<CourseEnrollment>(`/courses/${courseId}/enroll/`).then((response) => response.data);
  },
  myCourses() {
    return http.get<PaginatedResponse<EnrolledCourse>>('/courses/my/').then((response) => response.data);
  },
  adminList(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminCourse>>('/admin/courses/', { params }).then((response) => response.data);
  },
};
