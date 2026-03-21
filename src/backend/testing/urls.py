from django.urls import path

from testing.views import CourseTestInfoView, TestAttemptHistoryView, TestSubmitView


urlpatterns = [
    path("course/<uuid:course_id>/", CourseTestInfoView.as_view(), name="course-test-info"),
    path("<uuid:test_id>/submit/", TestSubmitView.as_view(), name="test-submit"),
    path("<uuid:test_id>/attempts/", TestAttemptHistoryView.as_view(), name="test-attempts"),
]
