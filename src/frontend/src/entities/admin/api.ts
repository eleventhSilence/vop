import { http } from '@/shared/api/http';
import type { CourseMedia } from '@/entities/course/types';
import type {
  AdminAnswerOption,
  AdminAnswerOptionCreatePayload,
  AdminAnswerOptionUpdatePayload,
  AdminCourse,
  AdminCourseParticipant,
  AdminCourseCreatePayload,
  AdminCourseListParams,
  AdminCourseUpdatePayload,
  AdminDashboard,
  AdminTest,
  AdminTestCreatePayload,
  AdminTestListParams,
  AdminTestQuestion,
  AdminTestQuestionCreatePayload,
  AdminTestQuestionUpdatePayload,
  AdminTestUpdatePayload,
  AdminUser,
  AdminUserDetail,
  AdminUserListParams,
  AdminUserUpdatePayload,
} from '@/entities/admin/types';
import type { PaginatedResponse } from '@/shared/lib/pagination';

type AdminCourseApiDto = {
  course_id: string;
  title: string;
  short_description: string;
  description: string;
  status: AdminCourse['status'];
  created_at: string;
  updated_at: string;
};

const mapAdminCourseFromApi = (course: AdminCourseApiDto): AdminCourse => ({
  course_id: course.course_id,
  title: course.title,
  short_description: course.short_description,
  content: course.description,
  status: course.status,
  created_at: course.created_at,
  updated_at: course.updated_at,
});

export const adminApi = {
  dashboard() {
    return http.get<AdminDashboard>('/admin/dashboard/').then((response) => response.data);
  },
  courses(params?: AdminCourseListParams) {
    return http.get<PaginatedResponse<AdminCourseApiDto>>('/admin/courses/', { params }).then((response) => ({
      ...response.data,
      results: response.data.results.map(mapAdminCourseFromApi),
    }));
  },
  tests(params?: AdminTestListParams) {
    return http.get<PaginatedResponse<AdminTest>>('/admin/tests/', { params }).then((response) => response.data);
  },
  courseDetail(courseId: string) {
    return http.get<AdminCourseApiDto>(`/admin/courses/${courseId}/`).then((response) => mapAdminCourseFromApi(response.data));
  },
  createCourse(payload: AdminCourseCreatePayload) {
    return http
      .post<AdminCourseApiDto>('/admin/courses/', {
        title: payload.title,
        short_description: payload.short_description,
        description: payload.content,
        status: payload.status,
      })
      .then((response) => mapAdminCourseFromApi(response.data));
  },
  updateCourse(courseId: string, payload: AdminCourseUpdatePayload) {
    return http
      .patch<AdminCourseApiDto>(`/admin/courses/${courseId}/`, {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.short_description !== undefined ? { short_description: payload.short_description } : {}),
        ...(payload.content !== undefined ? { description: payload.content } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
      })
      .then((response) => mapAdminCourseFromApi(response.data));
  },
  deleteCourse(courseId: string) {
    return http.delete(`/admin/courses/${courseId}/`);
  },
  courseMedia(courseId: string) {
    return http
      .get<CourseMedia[] | PaginatedResponse<CourseMedia>>(`/admin/courses/${courseId}/media/`)
      .then((response): CourseMedia[] => {
        const payload = response.data;
        if (Array.isArray(payload)) {
          return payload;
        }
        if (payload && Array.isArray(payload.results)) {
          return payload.results;
        }
        return [];
      });
  },
  courseParticipants(courseId: string, params?: { page?: number; page_size?: number; search?: string }) {
    return http
      .get<PaginatedResponse<AdminCourseParticipant>>(`/admin/courses/${courseId}/participants/`, { params })
      .then((response) => response.data);
  },
  uploadCourseMedia(courseId: string, payload: { file: File; title?: string }) {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.title) formData.append('title', payload.title);
    return http.post<CourseMedia>(`/admin/courses/${courseId}/media/`, formData, { headers: {'Content-Type': 'multipart/form-data'} }).then((r)=>r.data);
  },
  deleteCourseMedia(courseId: string, mediaId: string) {
    return http.delete(`/admin/courses/${courseId}/media/${mediaId}/`);
  },
  users(params?: AdminUserListParams) {
    return http.get<PaginatedResponse<AdminUser>>('/admin/users/', { params }).then((response) => response.data);
  },
  userDetail(userId: string) {
    return http.get<AdminUserDetail>(`/admin/users/${userId}/`).then((response) => response.data);
  },
  updateUser(userId: string, payload: AdminUserUpdatePayload) {
    return http.patch<AdminUserDetail>(`/admin/users/${userId}/`, payload).then((response) => response.data);
  },
  testDetail(testId: string) {
    return http.get<AdminTest>(`/admin/tests/${testId}/`).then((response) => response.data);
  },
  updateTest(testId: string, payload: AdminTestUpdatePayload) {
    return http.patch<AdminTest>(`/admin/tests/${testId}/`, payload).then((response) => response.data);
  },
  deleteTest(testId: string) {
    return http.delete(`/admin/tests/${testId}/`);
  },
  createTest(payload: AdminTestCreatePayload) {
    return http.post<AdminTest>('/admin/tests/', payload).then((response) => response.data);
  },
  questions(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminTestQuestion>>('/admin/questions/', { params }).then((response) => response.data);
  },
  questionDetail(questionId: string) {
    return http.get<AdminTestQuestion>(`/admin/questions/${questionId}/`).then((response) => response.data);
  },
  createQuestion(payload: AdminTestQuestionCreatePayload) {
    return http.post<AdminTestQuestion>('/admin/questions/', payload).then((response) => response.data);
  },
  updateQuestion(questionId: string, payload: AdminTestQuestionUpdatePayload) {
    return http.patch<AdminTestQuestion>(`/admin/questions/${questionId}/`, payload).then((response) => response.data);
  },
  deleteQuestion(questionId: string) {
    return http.delete(`/admin/questions/${questionId}/`);
  },
  answerOptions(params?: Record<string, string | number>) {
    return http.get<PaginatedResponse<AdminAnswerOption>>('/admin/answer-options/', { params }).then((response) => response.data);
  },
  createAnswerOption(payload: AdminAnswerOptionCreatePayload) {
    return http.post<AdminAnswerOption>('/admin/answer-options/', payload).then((response) => response.data);
  },
  updateAnswerOption(optionId: string, payload: AdminAnswerOptionUpdatePayload) {
    return http.patch<AdminAnswerOption>(`/admin/answer-options/${optionId}/`, payload).then((response) => response.data);
  },
  deleteAnswerOption(optionId: string) {
    return http.delete(`/admin/answer-options/${optionId}/`);
  },
};
