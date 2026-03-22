from django.urls import path

from courses.views import AdminCourseListCreateView, AdminCourseRetrieveUpdateView


urlpatterns = [
    path("courses/", AdminCourseListCreateView.as_view(), name="admin-course-list-create"),
    path("courses/<uuid:pk>/", AdminCourseRetrieveUpdateView.as_view(), name="admin-course-detail"),
]
