from django.urls import path

from courses.views import AdminCourseListCreateView, AdminCourseRetrieveUpdateView, AdminCourseMediaListCreateView, AdminCourseMediaDestroyView, AdminCourseParticipantsListView


urlpatterns = [
    path("courses/", AdminCourseListCreateView.as_view(), name="admin-course-list-create"),
    path("courses/<uuid:pk>/", AdminCourseRetrieveUpdateView.as_view(), name="admin-course-detail"),
    path("courses/<uuid:course_id>/participants/", AdminCourseParticipantsListView.as_view(), name="admin-course-participants-list"),
    path("courses/<uuid:course_id>/media/", AdminCourseMediaListCreateView.as_view(), name="admin-course-media-list-create"),
    path("courses/<uuid:course_id>/media/<uuid:pk>/", AdminCourseMediaDestroyView.as_view(), name="admin-course-media-destroy"),
]
