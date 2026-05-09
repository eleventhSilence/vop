from django.urls import path

from testing.views import CourseTestInfoView, MyCourseTestInfoView, TestAttemptDetailView, TestAttemptHistoryView, TestSubmitView, TestAttemptStartView, TestActiveAttemptView, TestAttemptInterruptView


urlpatterns = [
    path("course/<uuid:course_id>/", CourseTestInfoView.as_view(), name="course-test-info"),
    path("my/course/<uuid:course_id>/", MyCourseTestInfoView.as_view(), name="my-course-test-info"),
    path("<uuid:test_id>/submit/", TestSubmitView.as_view(), name="test-submit"),
    path("<uuid:test_id>/attempts/start/", TestAttemptStartView.as_view(), name="test-attempt-start"),
    path("<uuid:test_id>/attempts/active/", TestActiveAttemptView.as_view(), name="test-attempt-active"),
    path("<uuid:test_id>/attempts/", TestAttemptHistoryView.as_view(), name="test-attempts"),
    path("attempts/<uuid:attempt_id>/", TestAttemptDetailView.as_view(), name="test-attempt-detail"),
    path("attempts/<uuid:attempt_id>/interrupt/", TestAttemptInterruptView.as_view(), name="test-attempt-interrupt"),
]
