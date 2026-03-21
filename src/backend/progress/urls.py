from django.urls import path

from progress.views import CompleteTheoryView, CourseProgressDetailView, MyCourseProgressListView


urlpatterns = [
    path("my/", MyCourseProgressListView.as_view(), name="progress-my-list"),
    path("course/<uuid:course_id>/", CourseProgressDetailView.as_view(), name="progress-course-detail"),
    path("course/<uuid:course_id>/complete-theory/", CompleteTheoryView.as_view(), name="progress-complete-theory"),
]
