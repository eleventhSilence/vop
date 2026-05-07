import type { AdminCourse, Course, CourseCatalogQueryParams, CourseDetail, CourseEnrollment, EnrolledCourse, MyCoursesQueryParams } from '@/entities/course/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';
import { http } from '@/shared/api/http';

export const coursesApi = {
  list(params?: CourseCatalogQueryParams) {
    return http.get<PaginatedResponse<Course>>('/courses/', { params }).then((response) => response.data);
  },
  detail(courseId: string) {
    return http.get<CourseDetail>(`/courses/${courseId}/`).then((response) => response.data);
  },
  myDetail(courseId: string) {
    return http.get<CourseDetail>(`/courses/my/${courseId}/`).then((response) => response.data);
  },
  enroll(courseId: string) {
    return http.post<CourseEnrollment>(`/courses/${courseId}/enroll/`).then((response) => response.data);
  },
  myCourses(params?: unknown) {
    const queryParams =
      params && typeof params === 'object' && ('search' in params || 'progress' in params)
        ? (params as MyCoursesQueryParams)
        : undefined;
    return http.get<PaginatedResponse<EnrolledCourse>>('/courses/my/', { params: queryParams }).then((response) => response.data);
  },
  adminList(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminCourse>>('/admin/courses/', { params }).then((response) => response.data);
  },
};
