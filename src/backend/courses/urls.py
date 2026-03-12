from django.urls import path

from courses.views import CourseDetailView, CourseEnrollView, CourseListView


urlpatterns = [
    path("", CourseListView.as_view(), name="course-list"),
    path("<uuid:pk>/", CourseDetailView.as_view(), name="course-detail"),
    path("<uuid:pk>/enroll/", CourseEnrollView.as_view(), name="course-enroll"),
]
